from typing import List

from injector import inject
from ninja_extra import api_controller, route
from ninja_jwt.authentication import AsyncJWTAuth

from .schemas import (
    CourseDetailSchema,
    CourseFeaturedOut,
    CourseIn,
    CourseOut,
    CoursePreviewOut,
    CourseShareOut,
    GetNextLessonSchema,
    LessonSchema,
    MessageSchema,
    ModuleMaterialSchema,
    QuizResult,
    QuizSchema,
    QuizSubmission,
    ShareClaimListOut,
    ShareClaimOut,
)
from .services import CourseService, LessonService


@api_controller("courses", tags=["Course"], auth=AsyncJWTAuth())
class CourseController:
    @inject
    def __init__(self, course_service: CourseService):
        self.course_service = course_service

    @route.get("", response=List[CourseOut])
    async def list_courses(self, request):
        return await self.course_service.list_courses(request.user)

    @route.post("", response=CourseOut)
    async def create_course(self, request, data: CourseIn):
        return await self.course_service.create_course(
            request.user, data.prompt, data.level, data.num_modules
        )

    @route.get("featured", response=List[CourseFeaturedOut], auth=None)
    async def list_featured_courses(self, request, q: str = ""):
        return await self.course_service.list_featured_courses(q=q or "")

    @route.get("share/{token}", response=CourseShareOut, auth=None)
    async def get_share_info(self, request, token: str):
        return await self.course_service.get_share_info(token)

    @route.get("{course_id}/preview", response=CoursePreviewOut, auth=None)
    async def get_course_preview(self, request, course_id: str):
        return await self.course_service.get_course_preview(course_id)

    @route.get("{course_id}/get-next-lesson")
    async def get_next_lesson(self, request, course_id: str, current_lesson: str = "0"):
        lesson = await self.course_service.get_next_lesson(
            request.user, course_id, current_lesson
        )
        if not lesson:
            return {"finished": True}
        return GetNextLessonSchema.from_orm(lesson)

    @route.get("{course_id}", response=CourseDetailSchema)
    async def get_course(self, request, course_id: str):
        return await self.course_service.get_course(course_id, request.user)

    @route.delete("{course_id}")
    async def delete_course(self, request, course_id: str):
        return await self.course_service.delete_course(course_id, request.user)

    @route.post("{course_id}/generate-module")
    async def generate_module(self, request, course_id: str):
        return await self.course_service.trigger_next_module(request.user.pk, course_id)

    @route.get("quiz/{lesson_id}", response=QuizSchema)
    async def get_quiz(self, lesson_id: str):
        return await self.course_service.get_quiz(lesson_id)

    @route.get("module-quiz/{module_id}", response=QuizSchema)
    async def get_module_quiz(self, request, module_id: str):
        return await self.course_service.get_module_quiz(request.user, module_id)

    @route.get("{course_id}/certificate")
    async def get_certificate(self, request, course_id: str):
        return await self.course_service.get_certificate_info(request.user, course_id)

    @route.post("quiz/{quiz_id}/submit", response=QuizResult)
    async def submit_quiz(self, request, quiz_id: str, data: QuizSubmission):
        return await self.course_service.submit_quiz(request.user, quiz_id, data.answers)

    @route.post("{course_id}/cancel")
    async def cancel_course(self, request, course_id: str):
        return await self.course_service.cancel_course(request.user, course_id)

    @route.post("{course_id}/share", response=CourseShareOut)
    async def share_course(self, request, course_id: str):
        return await self.course_service.generate_share_token(request.user, course_id)

    @route.post("share/{token}/claim", response=ShareClaimOut)
    async def claim_share(self, request, token: str):
        return await self.course_service.claim_share(request.user, token)

    @route.get("{course_id}/claims", response=List[ShareClaimListOut])
    async def get_course_claims(self, request, course_id: str):
        return await self.course_service.get_course_claims(request.user, course_id)

    @route.get("module-material/{module_id}", response=ModuleMaterialSchema)
    async def get_module_material(self, request, module_id: str):
        return await self.course_service.get_module_material(request.user, module_id)

    @route.post("{course_id}/clone", response=MessageSchema)
    async def clone_course(self, request, course_id: str):
        result = await self.course_service.clone_course(request.user, course_id)
        return {"msg": result.get("course_id", "")}


@api_controller("lessons", tags=["Lesson"], auth=AsyncJWTAuth())
class LessonController:
    @inject
    def __init__(self, lesson_service: LessonService):
        self.lesson_service = lesson_service

    @route.get("{lesson_id}", response=LessonSchema)
    async def get_lesson(self, request, lesson_id: str):
        lesson = await self.lesson_service.get_lesson(request.user, lesson_id)
        if not lesson:
            from ninja.errors import HttpError

            raise HttpError(404, "Você ainda não criou esta aula")
        return lesson

    @route.put("{lesson_id}/mark-watched")
    async def mark_watched(self, request, lesson_id: str):
        return await self.lesson_service.mark_watched(request.user, lesson_id)

    @route.put("{lesson_id}/mark-delivered")
    async def mark_delivered(self, request, lesson_id: str):
        return await self.lesson_service.mark_delivered(request.user, lesson_id)
