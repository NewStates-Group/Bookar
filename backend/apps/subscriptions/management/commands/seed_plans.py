from django.core.management.base import BaseCommand

from apps.subscriptions.models import SubscriptionPlan


class Command(BaseCommand):
    help = "Cria os planos de subscrição padrão"

    def handle(self, *args, **options):
        plans = [
            {
                "slug": "free",
                "name": "Free",
                "description": "Grátis, mas com acesso limitado.",
                "price": 0,
                "sort_order": 0,
                "monthly_limits": False,
                "max_explicador_messages": 10,
                "max_explicador_participants": 1,
                "max_courses_generated": 1,
                "max_mindmaps_generated": 1,
                "max_mindmap_modules": 1,
                "max_mindmap_quizzes": 0,
                "max_mindmap_materials": 0,
                "is_active": True,
                "manual_payment_iban": "AO004000009862210162",
                "manual_payment_account_name": "TEOFILO SECO BALUNDO",
                "manual_payment_phone": "+244 951 323 877",
            },
            {
                "slug": "pro",
                "name": "Pro",
                "description": "Para criadores a sério. Acesso ilimitado a cursos e mapas mentais.",
                "price": 6500,
                "sort_order": 1,
                "monthly_limits": True,
                "max_explicador_messages": 100,
                "max_explicador_participants": 3,
                "max_courses_generated": 10,
                "max_mindmaps_generated": 20,
                "max_mindmap_modules": None,
                "max_mindmap_quizzes": None,
                "max_mindmap_materials": None,
                "is_active": True,
                "manual_payment_iban": "AO004000009862210162",
                "manual_payment_account_name": "TEOFILO SECO BALUNDO",
                "manual_payment_phone": "+244 951 323 877",
            },
            {
                "slug": "pro_plus",
                "name": "Pro+",
                "description": "Tudo do Pro, mais equipa e prioridade máxima.",
                "price": 12000,
                "sort_order": 2,
                "monthly_limits": True,
                "max_explicador_messages": 1000,
                "max_explicador_participants": 10,
                "max_courses_generated": 20,
                "max_mindmaps_generated": 50,
                "max_mindmap_modules": None,
                "max_mindmap_quizzes": None,
                "max_mindmap_materials": None,
                "is_active": True,
                "manual_payment_iban": "AO004000009862210162",
                "manual_payment_account_name": "TEOFILO SECO BALUNDO",
                "manual_payment_phone": "+244 951 323 877",
            },
        ]

        for plan_data in plans:
            slug = plan_data.pop("slug")
            obj, created = SubscriptionPlan.objects.update_or_create(
                slug=slug, defaults=plan_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Plano '{slug}' criado"))
            else:
                self.stdout.write(f"Plano '{slug}' atualizado")
