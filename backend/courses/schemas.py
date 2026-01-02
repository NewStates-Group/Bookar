from typing import List

from ninja import ModelSchema, Schema
from ninja.orm import create_schema
from pydantic import Field

from .models import Course, CourseLevel, Lesson, Module


class CourseOut(ModelSchema):
    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "desc",
            "thumb",
            "level",
            "created_at",
            "status",
        ]


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
    title: str
    details: str = Field(..., max_length=200)
    level: CourseLevel


class ModuleDetailSchema(ModuleSchema):
    lessons: List[LessonSchema]


class CourseDetailSchema(CourseOut):
    modules: List[ModuleDetailSchema]
