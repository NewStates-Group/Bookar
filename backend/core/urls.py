from django.http import JsonResponse
from django.urls import path

from .api import api


def healthcheck(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("healthcheck/", healthcheck),
    path("api/v1/", api.urls),
]
