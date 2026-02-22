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
    errors = []
    for error in exc.errors():
        msg = error.get("msg", "")
        if msg.startswith("Value error, "):
            msg = msg.replace("Value error, ", "")
        
        # Normalize pydantic built-in errors to codes if needed, or just clean them
        if "value is not a valid email address" in msg.lower():
            msg = "INVALID_EMAIL"
            
        error["msg"] = msg
        errors.append(error)

    return api.create_response(
        request,
        {"message": "Validation Error", "errors": errors},
        status=422,
    )


@api.exception_handler(Exception)
def service_exception_handler(request, exc):
    return api.create_response(
        request,
        {"message": "Internal Server Error", "detail": str(exc)},
        status=500,
    )

