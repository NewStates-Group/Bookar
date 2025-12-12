from django.conf import settings
from django.conf.urls.static import static
from django.urls import path
from ninja_extra import NinjaExtraAPI

from courses.controllers import TagController, CourseController

api = NinjaExtraAPI(
    title="Bookar API",
    description="The greatest AI based learning plataform",
    csrf=False,
    version="0.0.1",
)

api.register_controllers(TagController, CourseController)

urlpatterns = [
    path("api/", api.urls),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
