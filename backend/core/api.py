from ninja_extra import NinjaExtraAPI

from accounts.controllers import AuthController
from courses.controllers import CourseController

api = NinjaExtraAPI(
    title="Bookar API",
    description="The greatest AI based learning plataform",
    csrf=False,
    version="0.0.1",
)

api.register_controllers(AuthController, CourseController)
