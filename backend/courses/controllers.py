from typing import List

from injector import inject
from ninja_extra import api_controller, route
from ninja_jwt.authentication import JWTAuth

from .schemas import CourseDetailSchema, CourseIn, CourseOut, LessonSchema
from .services import CourseService


@api_controller("courses/", tags=["Course"], auth=JWTAuth())
class CourseController:
    @inject
    def __init__(self, course_service: CourseService):
        self.course_service = course_service

    @route.get("", response=List[CourseOut])
    def list_courses(self, request):
        return self.course_service.list_courses(request.user)

    @route.post(response=CourseOut)
    def create_course(self, request, data: CourseIn):
        return self.course_service.create_course(user=request.user, prompt=data.prompt)

    @route.get("/get_lesson", response=LessonSchema)
    def get_lesson(self, course_id: int):
        return self.course_service.get_lesson(course_id)

    @route.post("/mark_watched")
    def mark_watched(self, lesson_id: int):
        return self.course_service.mark_watched(lesson_id)

    @route.get("/{course_id}", response=CourseDetailSchema)
    def get_course(self, course_id: int):
        return self.course_service.get_course(course_id)
