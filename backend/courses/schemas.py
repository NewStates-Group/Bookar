from typing import Optional

from ninja import Schema
from ninja.orm import create_schema
from pydantic import field_validator

from .models import Course, Lesson, Tag, LevelChoices


class CourseIn(Schema):
    title: str
    desc: str
    level: LevelChoices
    tag: int

    @field_validator("tag", mode="after")
    @classmethod
    def get_tag(cls, id: int) -> Tag:
        try:
            return Tag.objects.get(id=id)
        except Tag.DoesNotExist:
            raise ValueError("Tag inexistente")

TagSchema = create_schema(Tag)
CourseOut = create_schema(Course)
LessonSchema = create_schema(Lesson)
