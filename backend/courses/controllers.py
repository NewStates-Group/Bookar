from typing import List

from injector import inject
from ninja_extra import api_controller, route
from ninja_jwt.authentication import JWTAuth

from .schemas import (
    CourseDetailSchema,
    CourseIn,
    CourseOut,
    LessonSchema,
    GetNextLessonSchema,
    QuizResult,
    QuizSchema,
    QuizSubmission,
    MessageSchema,
    CourseShareOut,
    ShareClaimOut,
    ShareClaimListOut,
)
from .services import CourseService, LessonService


@api_controller("courses", tags=["Course"], auth=JWTAuth())
class CourseController:
    @inject
    def __init__(self, course_service: CourseService):
        self.course_service = course_service

    @route.get("", response=List[CourseOut])
    def list_courses(self, request):
        return self.course_service.list_courses(request.user)

    @route.post("", response=CourseOut)
    def create_course(self, request, data: CourseIn):
        return self.course_service.create_course(
            request.user, data.prompt, data.level, data.num_modules
        )

    @route.get("{course_id}", response=CourseDetailSchema)
    def get_course(self, request, course_id: str):
        return self.course_service.get_course(course_id, request.user)

    @route.delete("{course_id}")
    def delete_course(self, request, course_id: str):
        return self.course_service.delete_course(course_id, request.user)

    @route.get("{course_id}/get-next-lesson")
    def get_next_lesson(self, request, course_id: str, current_lesson: str = "0"):
        lesson = self.course_service.get_next_lesson(
            request.user, course_id, current_lesson
        )
        if not lesson:
            return {"finished": True}
        return GetNextLessonSchema.from_orm(lesson)

    @route.post("{course_id}/generate-module")
    def generate_module(self, request, course_id: str):
        return self.course_service.trigger_next_module(request.user.pk, course_id)

    @route.get("quiz/{lesson_id}", response=QuizSchema)
    def get_quiz(self, lesson_id: str):
        return self.course_service.get_quiz(lesson_id)

    @route.get("module-quiz/{module_id}", response=QuizSchema)
    def get_module_quiz(self, request, module_id: str):
        return self.course_service.get_module_quiz(request.user, module_id)

    @route.get("{course_id}/certificate")
    def get_certificate(self, request, course_id: str):
        return self.course_service.get_certificate_info(request.user, course_id)

    @route.post("quiz/{quiz_id}/submit", response=QuizResult)
    def submit_quiz(self, request, quiz_id: str, data: QuizSubmission):
        return self.course_service.submit_quiz(request.user, quiz_id, data.answers)

    @route.post("{course_id}/cancel")
    def cancel_course(self, request, course_id: str):
        return self.course_service.cancel_course(request.user, course_id)

    @route.post("{course_id}/share", response=CourseShareOut)
    def share_course(self, request, course_id: str):
        return self.course_service.generate_share_token(request.user, course_id)

    @route.get("share/{token}", response=CourseShareOut, auth=None)
    def get_share_info(self, request, token: str):
        return self.course_service.get_share_info(token)

    @route.post("share/{token}/claim", response=ShareClaimOut)
    def claim_share(self, request, token: str):
        return self.course_service.claim_share(request.user, token)

    @route.get("{course_id}/claims", response=List[ShareClaimListOut])
    def get_course_claims(self, request, course_id: str):
        return self.course_service.get_course_claims(request.user, course_id)


@api_controller("lessons", tags=["Lesson"], auth=JWTAuth())
class LessonController:
    @inject
    def __init__(self, lesson_service: LessonService):
        self.lesson_service = lesson_service

    @route.get("{lesson_id}", response=LessonSchema)
    def get_lesson(self, request, lesson_id: str):
        lesson = self.lesson_service.get_lesson(request.user, lesson_id)
        if not lesson:
            from ninja.errors import HttpError
            raise HttpError(404, "Você ainda não criou esta aula")
        return lesson

    @route.put("{lesson_id}/mark-watched")
    def mark_watched(self, request, lesson_id: str):
        return self.lesson_service.mark_watched(request.user, lesson_id)

    @route.put("{lesson_id}/mark-delivered")
    def mark_delivered(self, request, lesson_id: str):
        return self.lesson_service.mark_delivered(request.user, lesson_id)
