from datetime import datetime
from typing import List, Optional

from ninja import ModelSchema, Schema
from ninja.orm import create_schema
from pydantic import Field

from .models import Choice, Course, CourseLevel, Lesson, Module, Question, Quiz


class CourseOut(ModelSchema):
    is_fully_completed: bool = False
    is_completed: bool = False

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
            "max_modules",
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
        "delivered",
        "lesson_file",
        "narration",
        "key_points",
        "scene_suggestion",
        "created_at",
        "status",
    ],
)

GetNextLessonSchema = create_schema(
    Lesson,
    fields=[
        "id",
        "module",
        "watched",
        "status",
    ],
)
ModuleSchema = create_schema(Module, fields=["id", "name", "desc"])


class CourseIn(Schema):
    prompt: str
    level: CourseLevel
    num_modules: Optional[int] = 5


class ModuleDetailSchema(ModuleSchema):
    lessons: List[LessonSchema]
    quiz_id: int = None
    quiz_title: str = None

    @staticmethod
    def resolve_quiz_id(obj):
        return obj.quiz.id if hasattr(obj, "quiz") else None

    @staticmethod
    def resolve_quiz_title(obj):
        return obj.quiz.title if hasattr(obj, "quiz") else None


class CourseDetailSchema(CourseOut):
    modules: List[ModuleDetailSchema]
    is_fully_completed: bool = False


class ChoiceSchema(ModelSchema):
    class Meta:
        model = Choice
        fields = ["id", "text"]


class QuestionSchema(ModelSchema):
    choices: List[ChoiceSchema]

    class Meta:
        model = Question
        fields = ["id", "text"]


class QuizSchema(ModelSchema):
    questions: List[QuestionSchema]

    class Meta:
        model = Quiz
        fields = ["id", "title", "description"]


class AnswerIn(Schema):
    question_id: int
    choice_id: int


class QuizSubmission(Schema):
    answers: List[AnswerIn]


class QuizResult(Schema):
    score: float
    passed: bool
    correct_answers: List[int]  # List of correct Choice IDs


class MessageSchema(Schema):
    msg: str = ""
