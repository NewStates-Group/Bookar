import logging

from django.db.models.query import QuerySet
from ninja.errors import HttpError

from .utils import get_next_lesson
from .models import Course, Lesson
from .tasks import create_course_outline, create_course_thumb, generate_lesson

logger = logging.getLogger(__name__)


class CourseService:
    def list_courses(self, user) -> QuerySet[Course]:
        return Course.objects.filter(user=user).order_by("-created_at")

    def get_course(self, id: int) -> Course:
        try:
            course = Course.objects.prefetch_related("modules__lessons").get(pk=id)
            return course
        except Course.DoesNotExist:
            raise HttpError(404, "Curso não encontrado")

    def create_course(self, user, title: str, details: str, level: str) -> Course:
        course = Course.objects.create(user=user, title=title, level=level)
        create_course_outline.delay(course.pk, title, details, course.get_level_display())
        create_course_thumb.delay(course.pk, title)
        return course

    def get_lesson(self, course_id: int) -> Lesson:
        lesson = get_next_lesson(course_id)
        if lesson.status == "PENDING":
            generate_lesson.delay(lesson.id)
        return lesson

    def mark_watched(self, lesson_id: int):
        try:
            lesson = Lesson.objects.get(id=lesson_id)
            lesson.watched = True
            lesson.save()
            return {"success": True}
        except Lesson.DoesNotExist:
            raise HttpError(404, "Lição não encontrada")
