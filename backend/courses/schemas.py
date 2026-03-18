from datetime import datetime
from typing import List, Optional

from ninja import ModelSchema, Schema
from ninja.orm import create_schema
from pydantic import Field

from .models import Choice, Course, CourseEnrollment, CourseLevel, Lesson, Module, Question, Quiz


class CourseOut(ModelSchema):
    is_fully_completed: bool = False
    is_completed: bool = False
    certificate_status: str = "NOT_GENERATED"

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

    @staticmethod
    def resolve_thumb(obj):
        if obj.thumb:
            try:
                return obj.thumb.url
            except Exception:
                return str(obj.thumb)
        return None

    @staticmethod
    def resolve_is_fully_completed(obj, context):
        user = context.get("request").user
        return obj.is_fully_completed(user)

    @staticmethod
    def resolve_is_completed(obj, context):
        user = context.get("request").user
        return obj.is_completed(user)

    @staticmethod
    def resolve_certificate_status(obj, context):
        user = context.get("request").user
        enrollment = obj.enrollments.filter(user=user).first()
        return enrollment.certificate_status if enrollment else "NOT_GENERATED"


class LessonSchema(ModelSchema):
    watched: bool = False

    class Meta:
        model = Lesson
        fields = [
            "id",
            "module",
            "title",
            "desc",
            "duration",
            "delivered",
            "lesson_file",
            "narration",
            "key_points",
            "scene_suggestion",
            "created_at",
            "status",
        ]

    @staticmethod
    def resolve_watched(obj, context):
        user = context.get("request").user
        return obj.progress.filter(user=user, watched=True).exists()

    @staticmethod
    def resolve_lesson_file(obj):
        if obj.lesson_file:
            try:
                return obj.lesson_file.url
            except Exception:
                return str(obj.lesson_file)
        return None


class GetNextLessonSchema(ModelSchema):
    watched: bool = False

    class Meta:
        model = Lesson
        fields = [
            "id",
            "module",
            "status",
        ]

    @staticmethod
    def resolve_watched(obj, context):
        user = context.get("request").user
        return obj.progress.filter(user=user, watched=True).exists()
ModuleSchema = create_schema(Module, fields=["id", "name", "desc"])


class CourseIn(Schema):
    prompt: str
    level: CourseLevel
    num_modules: Optional[int] = 5


class ModuleDetailSchema(ModuleSchema):
    lessons: List[LessonSchema]
    quiz_id: Optional[int] = None
    quiz_title: Optional[str] = None
    last_quiz_score: Optional[float] = None
    last_quiz_passed: Optional[bool] = None

    @staticmethod
    def resolve_quiz_id(obj):
        return obj.quiz.id if hasattr(obj, "quiz") else None

    @staticmethod
    def resolve_quiz_title(obj):
        return obj.quiz.title if hasattr(obj, "quiz") else None

    @staticmethod
    def resolve_last_quiz_score(obj):
        return getattr(obj, "_last_quiz_score", None)

    @staticmethod
    def resolve_last_quiz_passed(obj):
        return getattr(obj, "_last_quiz_passed", None)


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


class EnrollmentOut(ModelSchema):
    class Meta:
        model = CourseEnrollment
        fields = [
            "id",
            "course",
            "user",
            "status",
            "enrolled_at",
            "last_accessed_at",
            "completed_at",
        ]
