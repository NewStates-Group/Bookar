from ninja_extra import NinjaExtraAPI
from ninja.errors import ValidationError as NinjaValidationError
from pydantic import ValidationError as PydanticValidationError

from accounts.controllers import AuthController
from courses.controllers import CourseController, LessonController

api = NinjaExtraAPI(
    title="Bookar API",
    description="The greatest AI based learning plataform",
    csrf=False,
    version="0.0.1",
)

api.register_controllers(AuthController, CourseController, LessonController)


@api.exception_handler(NinjaValidationError)
@api.exception_handler(PydanticValidationError)
def validation_exception_handler(request, exc):
    return api.create_response(
        request,
        {"message": "Validation Error", "errors": exc.errors()},
        status=422,
    )


@api.exception_handler(Exception)
def service_exception_handler(request, exc):
    return api.create_response(
        request,
        {"message": "Internal Server Error", "detail": str(exc)},
        status=500,
    )

