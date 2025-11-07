from ninja import Schema

from .models import LevelChoices


class CourseCreateSchema(Schema):
    title: str
    desc: str
    level: LevelChoices
    tag: int


class TagSchema(Schema):
    id: int | None = None
    name: str


class CoursePlanSchema(Schema):
    title: str
    outline: dict
