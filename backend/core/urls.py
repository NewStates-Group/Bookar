from django.urls import path

from ninja import NinjaAPI

api = NinjaAPI()

urlpatterns = [
    path('api/', api.urls),
]
