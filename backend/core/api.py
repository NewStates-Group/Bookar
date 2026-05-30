from ninja_extra import NinjaExtraAPI
from ninja.errors import ValidationError as NinjaValidationError
from pydantic import ValidationError as PydanticValidationError

from accounts.controllers import AuthController
from courses.controllers import CourseController, LessonController
from mind_maps.controllers import MindMapController
from explicador.controllers import ExplicadorController

api = NinjaExtraAPI(
    title="Bookar API",
    description="The greatest AI based learning plataform",
    csrf=False,
    version="0.0.1",
)

api.register_controllers(
    AuthController,
    CourseController,
    LessonController,
    MindMapController,
    ExplicadorController,
)


@api.exception_handler(NinjaValidationError)
@api.exception_handler(PydanticValidationError)
def validation_exception_handler(request, exc):
    errors = []
    # Handle both callable errors() (Pydantic v2) and list errors (Django Ninja)
    exc_errors = (
        exc.errors()
        if callable(getattr(exc, "errors", None))
        else getattr(exc, "errors", [])
    )

    for error in exc_errors:
        msg = error.get("msg", "")
        if msg.startswith("Value error, "):
            msg = msg.replace("Value error, ", "")

        lower_msg = msg.lower()
        if "value is not a valid email address" in lower_msg:
            msg = "invalid_email"

        error["msg"] = msg.upper()
        errors.append(error)

    return api.create_response(
        request,
        {"message": "Validation Error", "errors": errors},
        status=422,
    )


@api.exception_handler(Exception)
def service_exception_handler(request, exc):
    from django.conf import settings

    response_data = {"message": "Erro interno no servidor"}
    if settings.DEBUG:
        response_data["detail"] = str(exc)

    return api.create_response(
        request,
        response_data,
        status=500,
    )
