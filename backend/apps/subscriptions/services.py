import logging
from datetime import date, timedelta

from asgiref.sync import sync_to_async
from django.db.models import Sum
from django.utils import timezone
from ninja.errors import HttpError

from .models import (
    PaymentReceipt,
    SubscriptionHistory,
    SubscriptionPlan,
    UsageRecord,
    UserSubscription,
)
from .notification_service import (
    create_notification,
    get_notifications,
    get_unread_count,
    mark_all_notifications_read,
    mark_notification_read,
)
from .payment import get_provider

logger = logging.getLogger(__name__)


class SubscriptionService:
    async def get_user_plan(self, user):
        await self._expire_if_needed(user)
        sub = await self._get_or_create_subscription(user)
        return sub.plan

    async def get_user_subscription(self, user):
        await self._expire_if_needed(user)
        return await self._get_or_create_subscription(user)

    async def _free_plan(self):
        return await sync_to_async(SubscriptionPlan.objects.get)(slug="free")

    async def _get_or_create_subscription(self, user):
        free_plan = await self._free_plan()
        sub, created = await sync_to_async(UserSubscription.objects.get_or_create)(
            user=user,
            defaults={
                "plan": free_plan,
                "status": UserSubscription.Status.ACTIVE,
            },
        )
        return sub

    async def _expire_if_needed(self, user):
        try:
            sub = await sync_to_async(UserSubscription.objects.get)(user=user)
        except UserSubscription.DoesNotExist:
            return
        if sub.status != UserSubscription.Status.ACTIVE:
            return
        if sub.current_period_end is None:
            return
        if timezone.now() >= sub.current_period_end:
            await self._log_history(user, sub)
            sub.plan = await self._free_plan()
            sub.status = UserSubscription.Status.EXPIRED
            sub.current_period_end = None
            await sync_to_async(sub.save)()

    async def _activate_subscription(self, user, plan, gateway="manual", sub_id="", now=None):
        sub = await self._get_or_create_subscription(user)
        await self._log_history(user, sub)
        sub.plan = plan
        sub.status = UserSubscription.Status.ACTIVE
        sub.payment_gateway = gateway
        sub.gateway_subscription_id = sub_id
        now = now or timezone.now()
        sub.current_period_start = now
        if plan.monthly_limits:
            sub.current_period_end = now + timedelta(days=30)
        else:
            sub.current_period_end = None
        sub.canceled_at = None
        await sync_to_async(sub.save)()
        return sub

    async def list_plans(self, active_only: bool = True):
        qs = SubscriptionPlan.objects.all()
        if active_only:
            qs = qs.filter(is_active=True)
        return await sync_to_async(lambda: list(qs.order_by("sort_order")))()

    async def get_plan_by_slug(self, slug: str):
        try:
            return await sync_to_async(SubscriptionPlan.objects.get)(
                slug=slug, is_active=True
            )
        except SubscriptionPlan.DoesNotExist:
            raise HttpError(404, "Plano não encontrado")

    def _is_monthly_limits(self, plan):
        return plan.monthly_limits

    def _get_reference_date(self, plan):
        if self._is_monthly_limits(plan):
            return timezone.now().date().replace(day=1)
        return None

    async def get_usage(self, user, metric: str) -> int:
        plan = await self.get_user_plan(user)
        ref_date = self._get_reference_date(plan)
        qs = UsageRecord.objects.filter(user=user, metric=metric)
        if ref_date:
            qs = qs.filter(date=ref_date)
        total = await sync_to_async(
            lambda: qs.aggregate(total=Sum("count"))["total"] or 0
        )()
        return total

    async def increment_usage(self, user, metric: str, amount: int = 1):
        plan = await self.get_user_plan(user)
        ref_date = self._get_reference_date(plan)
        defaults = {"count": 0}
        if ref_date:
            record, created = await sync_to_async(
                UsageRecord.objects.get_or_create
            )(user=user, date=ref_date, metric=metric, defaults=defaults)
        else:
            record, created = await sync_to_async(
                UsageRecord.objects.get_or_create
            )(user=user, date=date(9999, 12, 31), metric=metric, defaults=defaults)
        record.count += amount
        await sync_to_async(record.save)(update_fields=["count"])
        return record.count

    def get_limit(self, plan, metric: str) -> int | None:
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

    async def get_remaining(self, user, metric: str) -> int | None:
        plan = await self.get_user_plan(user)
        limit = self.get_limit(plan, metric)
        if limit is None:
            return None
        used = await self.get_usage(user, metric)
        return max(0, limit - used)

    async def check_and_increment(self, user, metric: str, amount: int = 1):
        plan = await self.get_user_plan(user)
        limit = self.get_limit(plan, metric)
        used = await self.get_usage(user, metric)
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
        await self.increment_usage(user, metric, amount)
        return {"used": used + amount, "limit": limit, "remaining": remaining}

    async def check_limit(self, user, metric: str, current_count: int):
        plan = await self.get_user_plan(user)
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
                403,
                f"Limite de {label} atingido ({limit}/{limit}). Faz upgrade do teu plano para continuares.",
            )
        return True

    async def get_usage_summary(self, user) -> dict:
        plan = await self.get_user_plan(user)
        metrics = ["explicador_message", "course_generated", "mindmap_generated"]
        result = []
        for metric in metrics:
            limit = self.get_limit(plan, metric)
            used = await self.get_usage(user, metric)
            remaining = None if limit is None else max(0, limit - used)
            result.append({"metric": metric, "used": used, "limit": limit, "remaining": remaining})
        return {"metrics": result}

    async def upgrade(self, user, plan_slug: str, gateway: str = "stripe", success_url: str = "", cancel_url: str = ""):
        plan = await self.get_plan_by_slug(plan_slug)
        if plan.price == 0:
            return await self._assign_plan(user, plan)
        provider = get_provider(gateway)
        checkout = provider.create_checkout_session(plan, user, success_url, cancel_url)
        return checkout

    async def _assign_plan(self, user, plan):
        sub = await self._activate_subscription(user, plan, gateway="manual")
        sub.gateway_data = {}
        await sync_to_async(sub.save)()
        return sub

    async def _log_history(self, user, sub):
        await sync_to_async(SubscriptionHistory.objects.create)(
            user=user,
            plan=sub.plan,
            status=sub.status,
            payment_gateway=sub.payment_gateway,
            period_start=sub.current_period_start,
            period_end=sub.current_period_end,
            canceled_at=sub.canceled_at,
        )

    async def get_history(self, user):
        return await sync_to_async(
            lambda: list(SubscriptionHistory.objects.filter(user=user).select_related("plan"))
        )()

    async def cancel(self, user, gateway: str = ""):
        sub = await self._get_or_create_subscription(user)
        plan = sub.plan
        if not plan or plan.slug == "free":
            raise HttpError(400, "Não tens uma subscrição ativa para cancelar.")
        await self._log_history(user, sub)
        if sub.payment_gateway and sub.payment_gateway != "manual":
            provider = get_provider(sub.payment_gateway)
            provider.cancel_subscription(sub)
        sub.plan = await self._free_plan()
        sub.status = UserSubscription.Status.ACTIVE
        sub.payment_gateway = ""
        sub.gateway_subscription_id = ""
        sub.canceled_at = timezone.now()
        await sync_to_async(sub.save)()
        return {"success": True, "message": "Subscrição cancelada com sucesso."}

    async def handle_webhook(self, request, gateway: str):
        provider = get_provider(gateway)
        return await sync_to_async(provider.handle_webhook)(request)

    async def confirm_checkout(self, user, session_id: str, gateway: str = "stripe"):
        try:
            provider = get_provider(gateway)
        except ValueError:
            raise HttpError(400, f"Gateway de pagamento inválido: {gateway}")
        session = await sync_to_async(provider.retrieve_checkout_session)(session_id)
        if not session:
            raise HttpError(404, "Sessão de pagamento não encontrada")
        if gateway == "stripe":
            status = getattr(session, "status", None)
            if status != "complete":
                raise HttpError(400, f"Pagamento ainda não foi concluído (status: {status})")
            sub_id = getattr(session, "subscription", None)
            metadata = session.metadata or {}
        else:
            status = session.get("status", "")
            status_map = {"completed": "complete", "active": "complete", "paid": "complete", "success": "complete"}
            mapped = status_map.get(status, status)
            if mapped != "complete":
                raise HttpError(400, f"Pagamento ainda não foi concluído (status: {status})")
            sub_id = session.get("subscription_id", session.get("id", ""))
            metadata = session.get("metadata", {})
        try:
            plan_slug = metadata["plan_slug"]
            session_user_id = metadata["user_id"]
        except KeyError:
            raise HttpError(400, "Requisição incompleta")
        if not plan_slug or not session_user_id:
            raise HttpError(400, "Requisição incompleta")
        if str(session_user_id) != str(user.id):
            raise HttpError(403, "Erro no plano/sessão")
        plan = await self.get_plan_by_slug(plan_slug)
        await self._activate_subscription(user, plan, gateway=gateway, sub_id=sub_id or "")
        return {"success": True, "plan": plan_slug}

    async def submit_manual_receipt(self, user, plan_slug: str, receipt_file):
        plan = await self.get_plan_by_slug(plan_slug)
        if plan.price == 0:
            raise HttpError(400, "Este plano é gratuito.")
        exists = await sync_to_async(
            PaymentReceipt.objects.filter(
                user=user, plan=plan, status=PaymentReceipt.Status.PENDING
            ).exists
        )()
        if exists:
            raise HttpError(400, "Já tens um comprovativo pendente para este plano.")
        receipt = await sync_to_async(PaymentReceipt.objects.create)(
            user=user, plan=plan, receipt=receipt_file,
            amount=plan.price, iban=plan.manual_payment_iban,
            account_name=plan.manual_payment_account_name,
            phone=plan.manual_payment_phone,
            status=PaymentReceipt.Status.PENDING,
        )
        receipt_url = ""
        if receipt.receipt and hasattr(receipt.receipt, "url"):
            receipt_url = receipt.receipt.url
        from .tasks import send_receipt_notification_task
        send_receipt_notification_task.delay(user.id, plan.id, receipt_url, str(receipt.secret_token))
        return {"id": receipt.id, "status": receipt.status}

    async def get_user_receipts(self, user):
        return await sync_to_async(
            lambda: list(PaymentReceipt.objects.filter(user=user).select_related("plan"))
        )()

    async def get_notifications(self, user):
        return await get_notifications(user)

    async def get_unread_count(self, user):
        return await get_unread_count(user)

    async def mark_notification_read(self, notification_id, user):
        return await mark_notification_read(notification_id, user)

    async def mark_all_notifications_read(self, user):
        return await mark_all_notifications_read(user)

    async def approve_receipt_by_token(self, token: str):
        try:
            receipt = await sync_to_async(
                PaymentReceipt.objects.select_related("user", "plan").get
            )(secret_token=token, status=PaymentReceipt.Status.PENDING)
        except PaymentReceipt.DoesNotExist:
            raise HttpError(404, "Comprovativo não encontrado ou já processado.")
        plan = receipt.plan
        if not plan:
            raise HttpError(400, "Plano associado ao comprovativo não encontrado.")
        now = timezone.now()
        await self._activate_subscription(receipt.user, plan, gateway="manual", now=now)
        receipt.status = PaymentReceipt.Status.APPROVED
        receipt.reviewed_at = now
        await sync_to_async(receipt.save)(update_fields=["status", "reviewed_at"])
        try:
            await create_notification(
                user=receipt.user,
                title="Comprovativo aprovado!",
                message=f"O teu plano {plan.name} foi ativado com sucesso.",
                type="receipt_approved",
                link="/app/subscription",
            )
        except Exception as e:
            logger.warning(f"Failed to notify user: {e}")
        return {"success": True, "message": f"Comprovativo aprovado. O plano {plan.name} foi ativado para {receipt.user.email}."}

    async def reject_receipt_by_token(self, token: str, notes: str = ""):
        try:
            receipt = await sync_to_async(
                PaymentReceipt.objects.select_related("user", "plan").get
            )(secret_token=token, status=PaymentReceipt.Status.PENDING)
        except PaymentReceipt.DoesNotExist:
            raise HttpError(404, "Comprovativo não encontrado ou já processado.")
        receipt.status = PaymentReceipt.Status.REJECTED
        receipt.admin_notes = notes
        receipt.reviewed_at = timezone.now()
        await sync_to_async(receipt.save)(update_fields=["status", "admin_notes", "reviewed_at"])
        try:
            await create_notification(
                user=receipt.user,
                title="Comprovativo recusado",
                message=notes or "O teu comprovativo foi recusado. Tenta enviar um novo.",
                type="receipt_rejected",
                link="/app/subscription",
            )
        except Exception as e:
            logger.warning(f"Failed to notify user: {e}")
        return {"success": True, "message": "Comprovativo recusado com sucesso."}
