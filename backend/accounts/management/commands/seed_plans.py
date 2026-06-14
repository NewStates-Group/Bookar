from django.core.management.base import BaseCommand

from accounts.models import SubscriptionPlan


PLANS = [
    {
        "slug": "free",
        "name": "Free",
        "description": "Para experimentares a plataforma.",
        "price": 0,
        "sort_order": 0,
        "monthly_limits": False,
        "max_explicador_messages": 3,
        "max_explicador_participants": 0,
        "max_courses_generated": 0,
        "max_mindmaps_generated": 1,
        "max_mindmap_modules": 0,
        "max_mindmap_quizzes": 0,
        "max_mindmap_materials": 0,
    },
    {
        "slug": "pro",
        "name": "Pro",
        "description": "Para estudantes a sério.",
        "gateway_price_id": "price_1Ti12fGckpVNeKCFoxkCJWvt",
        "price": 6500,
        "sort_order": 1,
        "monthly_limits": True,
        "max_explicador_messages": 150,
        "max_explicador_participants": 2,
        "max_courses_generated": 0,
        "max_mindmaps_generated": 10,
        "max_mindmap_modules": None,
        "max_mindmap_quizzes": None,
        "max_mindmap_materials": None,
    },
    {
        "slug": "pro_plus",
        "name": "Pro+",
        "description": "Para aqueles que estudam de verdade.",
        "gateway_price_id": "price_1Ti14JGckpVNeKCFB0KW5Kdg",
        "price": 12000,
        "sort_order": 2,
        "monthly_limits": True,
        "max_explicador_messages": 1000,
        "max_explicador_participants": 5,
        "max_courses_generated": 0,
        "max_mindmaps_generated": 20,
        "max_mindmap_modules": None,
        "max_mindmap_quizzes": None,
        "max_mindmap_materials": None,
    },
]

class Command(BaseCommand):
    help = "Seed subscription plans"

    def handle(self, *args, **options):
        for plan_data in PLANS:
            slug = plan_data["slug"]
            obj, created = SubscriptionPlan.objects.update_or_create(
                slug=slug,
                defaults=plan_data,
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Plano '{slug}' criado"))
            else:
                self.stdout.write(self.style.SUCCESS(f"Plano '{slug}' atualizado"))

        self.stdout.write(self.style.SUCCESS("Planos sincronizados com sucesso!"))
