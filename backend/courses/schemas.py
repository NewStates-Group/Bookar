from typing import List

from django.conf import settings
from ninja import ModelSchema, Schema
from ninja.orm import create_schema
from pydantic import Field, computed_field

from .models import Course, CourseLevel, Lesson, Module


class CourseOut(ModelSchema):
    class Meta:
        model = Course
        fields = [
            "uuid",
            "title",
            "desc",
            "created_at",
            "status",
        ]

    @computed_field
    @property
    def thumb(self) -> str | None:
        if not self._obj.thumb:
            return None
        return settings.SITE_URL + self._obj.thumb.url


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
