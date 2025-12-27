from typing import List

from ninja import Schema
from ninja.orm import create_schema
from pydantic import Field

from .models import Course, Lesson, Module

CourseOut = create_schema(
    Course,
    fields=[
        "id",
        "title",
        "desc",
        "thumb",
        "created_at",
        "status",
    ],
)
LessonSchema = create_schema(
    Lesson,
    fields=[
        "id",
        "module",
        "title",
        "desc",
        "duration",
        "watched",
        "lesson_file",
        "narration",
        "key_points",
        "scene_suggestion",
        "created_at",
        "status",
    ],
)
ModuleSchema = create_schema(Module, fields=["id", "name", "desc"])


class CourseIn(Schema):
    prompt: str = Field(..., max_length=250)


class ModuleDetailSchema(ModuleSchema):
    lessons: List[LessonSchema]


class CourseDetailSchema(CourseOut):
    modules: List[ModuleDetailSchema]
