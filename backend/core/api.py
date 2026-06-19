from apps.accounts.controllers import AuthController
from apps.courses.controllers import CourseController, LessonController
from apps.explicador.controllers import ExplicadorController
from apps.feedback.controllers import FeedbackController
from apps.folhas.controllers import FolhaController
from apps.mind_maps.controllers import MindMapController
from apps.notifications.controllers import NotificationController
from apps.subscriptions.controllers import SubscriptionController
from django.conf import settings
from django.http import HttpResponse
from django.urls import path
from ninja.errors import ValidationError as NinjaValidationError
from ninja_extra import NinjaExtraAPI
from pydantic import ValidationError as PydanticValidationError

api = NinjaExtraAPI(
    title="Bookar API",
    description="The greatest AI based learning plataform",
    csrf=False,
    version="0.0.1",
)

api.register_controllers(
    AuthController,
    SubscriptionController,
    CourseController,
    LessonController,
    MindMapController,
    ExplicadorController,
    FolhaController,
    FeedbackController,
    NotificationController,
)


@api.exception_handler(NinjaValidationError)
@api.exception_handler(PydanticValidationError)
def validation_exception_handler(request, exc):
    _errors = []
    if hasattr(exc, "errors"):
        _errors = exc.errors() if callable(exc.errors) else exc.errors

    errors = [
        {
            "loc": error.get("loc", ""),
            "msg": error.get("msg", ""),
        }
        for error in _errors  # type: ignore
    ]

    return api.create_response(
        request,
        {"errors": errors},
        status=422,
    )


@api.exception_handler(Exception)
def service_exception_handler(request, exc):
    response_data = {"error": "INTERNAL_ERROR"}
    if settings.DEBUG:
        response_data["detail"] = str(exc)

    return api.create_response(
        request,
        response_data,
        status=500,
    )


@api.get("healthcheck/")
async def healthcheck(request):
    return HttpResponse("ok", content_type="text/plain")  # type: ignore


urlpatterns = [
    path("api/", api.urls),
]

handler400 = "utils.errors.handler400"
handler403 = "utils.errors.handler403"
handler404 = "utils.errors.handler404"
handler500 = "utils.errors.handler500"
