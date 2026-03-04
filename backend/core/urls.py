from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.urls import path

from .api import api


def healthcheck(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("healthcheck/", healthcheck),
    path("api/", api.urls),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
