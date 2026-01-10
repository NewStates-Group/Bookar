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
            user=request.user, details=data.details, level=data.level, title=data.title
        )

    @route.get("/{id}", response=CourseDetailSchema)
    def get_course(self, id: int):
        return self.course_service.get_course(id)

    @route.get("/{course_id}/get-next-lesson/", response=GetNextLessonSchema)
    def get_next_lesson(self, request, course_id: int):
        return self.course_service.get_next_lesson(request.user, course_id)

    

    @route.get("/get-lesson/{course_id}", response=LessonSchema)
    def get_lesson(self, course_id: int):
        return self.course_service.get_lesson(course_id)

    

    @route.get("/quiz/{lesson_id}", response=QuizSchema)
    def get_quiz(self, lesson_id: int):
        return self.course_service.get_quiz(lesson_id)

    @route.post("/quiz/{quiz_id}/submit", response=QuizResult)
    def submit_quiz(self, request, quiz_id: int, data: QuizSubmission):
        return self.course_service.submit_quiz(request.user, quiz_id, data.answers)

    @route.post("/{course_id}/generate-module")
    def generate_module(self, course_id: int):
        return self.course_service.trigger_next_module(course_id)

    @route.delete("/{course_id}")
    def delete_course(self, request, course_id: int):
        return self.course_service.delete_course(course_id, request.user)


@api_controller("lesson", tags=["Lesson"], auth=JWTAuth())
class LessonController:
    @inject
    def __init__(self, lesson_service: LessonService):
        self.lesson_service = lesson_service

    @route.get("{lesson_id}", response=LessonSchema)
    def get_lesson(self, request, lesson_id: int):
        return self.course_service.get_lesson_data(request.user, lesson_id)

    @route.post("{lesson_id}/mark-watched")
    def mark_watched(self, lesson_id: int):
        return self.course_service.mark_watched(lesson_id)
    
    @route.post("{lesson_id}/mark-delivered")
    def mark_delivered(self, lesson_id: int):
        return self.course_service.mark_delivered(lesson_id)