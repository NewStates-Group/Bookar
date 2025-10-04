from django.urls import path
from ninja import NinjaAPI
from courses.api import router as courses_router

api = NinjaAPI(
    title="Bookar API",
    csrf=False,
)

api.add_router('/courses/', courses_router)

urlpatterns = [
    path('api/', api.urls),
]
