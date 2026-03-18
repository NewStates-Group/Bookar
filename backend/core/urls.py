from django.conf import settings
from django.http import JsonResponse
from django.urls import path

from .api import api


def healthcheck(request):
    return JsonResponse({"status": "ok"})


from courses.sse import course_sse_stream, lesson_sse_stream

urlpatterns = [
    path("healthcheck/", healthcheck),
    path("sse/courses/<int:course_id>/", course_sse_stream),
    path("sse/lessons/<int:lesson_id>/", lesson_sse_stream),
    path("api/", api.urls),
]
