import logging
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from ninja.errors import HttpError

from accounts.payment import get_provider

from .models import SubscriptionPlan, UsageRecord, UserSubscription

User = get_user_model()
logger = logging.getLogger(__name__)


class SubscriptionError(Exception):
    def __init__(self, message: str, code: str = "subscription_limit"):
        self.message = message
        self.code = code
        super().__init__(message)


class SubscriptionService:
    def get_user_plan(self, user):
        """Get the user's current subscription with plan."""
        sub = self._get_or_create_subscription(user)
        return sub.plan

    def get_user_subscription(self, user):
        """Get the user's full subscription object."""
        return self._get_or_create_subscription(user)

    def _get_or_create_subscription(self, user):
        sub, created = UserSubscription.objects.get_or_create(
            user=user,
            defaults={
                "plan": SubscriptionPlan.objects.get(slug="free"),
                "status": UserSubscription.Status.ACTIVE,
            },
        )
        return sub

    def list_plans(self, active_only: bool = True):
        qs = SubscriptionPlan.objects.all()
        if active_only:
            qs = qs.filter(is_active=True)
        return qs.order_by("sort_order")

    def get_plan_by_slug(self, slug: str):
        try:
            return SubscriptionPlan.objects.get(slug=slug, is_active=True)
        except SubscriptionPlan.DoesNotExist:
            raise HttpError(404, "Plano não encontrado")

    def _is_monthly_limits(self, plan):
        return plan.monthly_limits

    def _get_reference_date(self, plan):
        if self._is_monthly_limits(plan):
            return timezone.now().date().replace(day=1)
        return None

    def get_usage(self, user, metric: str) -> int:
        """Get current usage for a given metric (daily or total based on plan)."""
        plan = self.get_user_plan(user)
        ref_date = self._get_reference_date(plan)

        qs = UsageRecord.objects.filter(user=user, metric=metric)
        if ref_date:
            qs = qs.filter(date=ref_date)

        total = qs.aggregate(total=Sum("count"))["total"] or 0
        return total

    def increment_usage(self, user, metric: str, amount: int = 1):
        """Increment usage counter for a metric. Creates record if not exists."""
        plan = self.get_user_plan(user)
        ref_date = self._get_reference_date(plan)

        if ref_date:
            record, created = UsageRecord.objects.get_or_create(
                user=user,
                date=ref_date,
                metric=metric,
                defaults={"count": 0},
            )
        else:
            record, created = UsageRecord.objects.get_or_create(
                user=user,
                date=date(9999, 12, 31),
                metric=metric,
                defaults={"count": 0},
            )

        record.count += amount
        record.save(update_fields=["count"])
        return record.count

    def get_limit(self, plan, metric: str) -> int | None:
        """Get the limit value for a given metric on a plan. None = unlimited."""
        field_map = {
            "explicador_message": "max_explicador_messages",
            "explicador_participants": "max_explicador_participants",
            "course_generated": "max_courses_generated",
            "mindmap_generated": "max_mindmaps_generated",
            "mindmap_module": "max_mindmap_modules",
            "mindmap_quiz": "max_mindmap_quizzes",
            "mindmap_material": "max_mindmap_materials",
        }
        field_name = field_map.get(metric)
        if not field_name:
            return None
        return getattr(plan, field_name, None)

    def get_remaining(self, user, metric: str) -> int | None:
        """Get remaining uses for a metric. Returns None if unlimited."""
        plan = self.get_user_plan(user)
        limit = self.get_limit(plan, metric)

        if limit is None:
            return None

        used = self.get_usage(user, metric)
        return max(0, limit - used)

    def check_and_increment(self, user, metric: str, amount: int = 1):
        """
        Check if user can perform an action and increment usage if allowed.
        Raises HttpError if limit is exceeded.
        """
        plan = self.get_user_plan(user)
        limit = self.get_limit(plan, metric)

        used = self.get_usage(user, metric)
        remaining = None if limit is None else limit - used

        if limit is not None and used + amount > limit:
            metric_labels = {
                "explicador_message": "mensagens no explicador",
                "course_generated": "cursos gerados",
                "mindmap_generated": "mapas mentais gerados",
            }
            label = metric_labels.get(metric, metric)
            if self._is_monthly_limits(plan):
                msg = f"Limite mensal de {label} atingido ({limit}/{limit}). Faz upgrade do teu plano para continuares."
            else:
                msg = f"Limite de {label} atingido ({limit}/{limit}). Faz upgrade do teu plano para continuares."
            raise HttpError(403, msg)

        self.increment_usage(user, metric, amount)
        return {"used": used + amount, "limit": limit, "remaining": remaining}

    def check_limit(self, user, metric: str, current_count: int):
        """
        Check a structural limit (e.g. number of modules in a mind map).
        Does NOT increment usage.
        """
        plan = self.get_user_plan(user)
        limit = self.get_limit(plan, metric)

        if limit is not None and current_count >= limit:
            metric_labels = {
                "mindmap_module": "módulos por mapa mental",
                "mindmap_quiz": "testes por mapa mental",
                "mindmap_material": "materiais de leitura por mapa mental",
                "explicador_participants": "participantes por sala",
            }
            label = metric_labels.get(metric, metric)
            raise HttpError(
                403, f"Limite de {label} atingido ({limit}/{limit}). Faz upgrade do teu plano para continuares."
            )
        return True

    def get_usage_summary(self, user) -> dict:
        """Get usage summary for all tracked metrics."""
        plan = self.get_user_plan(user)
        metrics = [
            "explicador_message",
            "course_generated",
            "mindmap_generated",
        ]
        result = []
        for metric in metrics:
            limit = self.get_limit(plan, metric)
            used = self.get_usage(user, metric)
            remaining = None if limit is None else max(0, limit - used)
            result.append({
                "metric": metric,
                "used": used,
                "limit": limit,
                "remaining": remaining,
            })
        return {"metrics": result}

    def upgrade(self, user, plan_slug: str, gateway: str = "stripe", success_url: str = "", cancel_url: str = ""):
        """Initiate an upgrade to a new plan via the specified gateway."""
        plan = self.get_plan_by_slug(plan_slug)

        if plan.price == 0:
            return self._assign_plan(user, plan)

        provider = get_provider(gateway)
        checkout = provider.create_checkout_session(
            plan, user, success_url, cancel_url
        )
        return checkout

    def _assign_plan(self, user, plan):
        """Directly assign a plan to a user (for free plans or admin)."""
        sub = self._get_or_create_subscription(user)
        sub.plan = plan
        sub.status = UserSubscription.Status.ACTIVE
        sub.payment_gateway = "manual"
        sub.current_period_start = timezone.now()
        sub.current_period_end = None
        sub.canceled_at = None
        sub.gateway_data = {}
        sub.save()
        return sub

    def cancel(self, user, gateway: str = ""):
        """Cancel user's current subscription."""
        sub = self._get_or_create_subscription(user)
        plan = sub.plan

        if not plan or plan.slug == "free":
            raise HttpError(400, "Não tens uma subscrição ativa para cancelar.")

        if sub.payment_gateway and sub.payment_gateway != "manual":
            provider = get_provider(sub.payment_gateway)
            provider.cancel_subscription(sub)

        free_plan = SubscriptionPlan.objects.get(slug="free")
        sub.plan = free_plan
        sub.status = UserSubscription.Status.ACTIVE
        sub.payment_gateway = ""
        sub.gateway_subscription_id = ""
        sub.canceled_at = timezone.now()
        sub.save()
        return {"success": True, "message": "Subscrição cancelada com sucesso."}

    def handle_webhook(self, request, gateway: str):
        """Route webhook to the appropriate payment provider."""
        provider = get_provider(gateway)
        return provider.handle_webhook(request)

    def confirm_checkout(self, user, session_id: str):
        """Synchronously confirm a Stripe checkout session and update the user's plan."""
        logger.info(f"confirm_checkout called for user {user.id} with session {session_id}")
        from accounts.payment.stripe import StripePaymentProvider
        try:
            try:
                provider = StripePaymentProvider()
            except Exception as e:
                logger.critical("Stripe init failed")
                raise HttpError(500, "Erro ao conectar com o Stripe")

            try:
                session = provider.retrieve_checkout_session(session_id)
            except Exception as e:
                logger.critical("Failed to retrieve Stripe session")
                raise HttpError(500, f"Erro ao verificar sessão: {e}")

            if not session:
                logger.critical(f"Session {session_id} not found in Stripe")
                raise HttpError(404, "Sessão de pagamento não encontrada")

            status = getattr(session, "status", None)

            if status != "complete":
                raise HttpError(400, f"Pagamento ainda não foi concluído (status: {status})")

            sub_id = getattr(session, "subscription", None)
            metadata = session.metadata or {}
            plan_slug, session_user_id = [None] * 2
            
            try:
                plan_slug = metadata["plan_slug"]
                session_user_id = metadata["user_id"]
            except KeyError:
                raise HttpError(400, "Requisição incompleta")

            if str(session_user_id) != str(user.id) or not plan_slug:
                raise HttpError(403, "Erro no plano/sessão")

            if not sub_id:
                raise HttpError(404, "Subscrição não encontrada")

            plan = self.get_plan_by_slug(plan_slug)
            sub = self._get_or_create_subscription(user)
            sub.plan = plan
            sub.status = UserSubscription.Status.ACTIVE
            sub.payment_gateway = "stripe"
            sub.gateway_subscription_id = sub_id or ""
            sub.current_period_start = timezone.now()
            sub.canceled_at = None
            sub.save()
            return {"success": True, "plan": plan_slug}
        except Exception as e:
            logger.critical("ERROR: "+ str(e))
            return {"success": False, "plan": ""}


