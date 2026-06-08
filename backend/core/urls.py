from django.http import JsonResponse
from django.urls import path, include
from django.contrib.staticfiles.urls import staticfiles_urlpatterns

from .api import api


def healthcheck(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("healthcheck/", healthcheck),
    path("api/", api.urls),
    path("silk/", include("silk.urls", namespace="silk")),
] + staticfiles_urlpatterns()
