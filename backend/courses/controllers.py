from typing import List
from ninja_extra import api_controller, route

from injector import inject

from .schemas import CourseIn, CourseOut, LessonSchema, TagSchema
from .services import TagService, CourseService


@api_controller("tags/")
class TagController:
    @inject
    def __init__(self, tag_service: TagService):
        self.tag_service = tag_service

    @route.get(response=List[TagSchema])
    def get_tags(self):
        return self.tag_service.get_tags()

    @route.post(response=TagSchema)
    def create_tag(self, data: TagSchema):
        return self.tag_service.create_tag(data.name)


@api_controller("courses/")
class CourseController:
    @inject
    def __init__(self, course_service: CourseService):
        self.course_service = course_service

    @route.post(response=CourseOut)
    def create_course(self, data: CourseIn):
        return self.course_service.create_course(
            title=data.title.strip(),
            desc=data.desc.strip(),
            level=data.level,
            tag=data.tag,
        )

    @route.get("/get_lesson", response=LessonSchema)
    def get_lesson(self, course_id: int):
        return self.course_service.get_lesson(course_id)
