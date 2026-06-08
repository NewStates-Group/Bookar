import logging
from datetime import datetime
from typing import List, Optional

from ninja import ModelSchema, Schema
from ninja.orm import create_schema

from .models import (
    Choice,
    Course,
    CourseEnrollment,
    CourseLevel,
    Lesson,
    Module,
    Question,
    Quiz,
)

logger = logging.Logger(__name__)


class CourseOut(ModelSchema):
    is_fully_completed: bool = False
    is_completed: bool = False
    certificate_status: str = "NOT_GENERATED"
    certificate_url: Optional[str] = None
    is_owner: bool = False

    class Meta:
        model = Course
        fields = [
            "title",
            "desc",
            "thumb",
            "level",
            "created_at",
            "status",
            "max_modules",
        ]

    id: str = None

    @staticmethod
    def resolve_id(obj):
        return str(obj.uuid)

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
        if hasattr(obj, "_precomputed_is_fully_completed"):
            return obj._precomputed_is_fully_completed
        user = context.get("request").user
        return obj.is_fully_completed(user)

    @staticmethod
    def resolve_is_completed(obj, context):
        if hasattr(obj, "_precomputed_is_completed"):
            return obj._precomputed_is_completed
        user = context.get("request").user
        return obj.is_completed(user)

    @staticmethod
    def resolve_certificate_status(obj, context):
        if hasattr(obj, "_precomputed_certificate_status"):
            return obj._precomputed_certificate_status
        user = context.get("request").user
        enrollment = obj.enrollments.filter(user=user).only("certificate_status").first()
        return enrollment.certificate_status if enrollment else "NOT_GENERATED"

    @staticmethod
    def resolve_certificate_url(obj, context):
        if hasattr(obj, "_precomputed_certificate_url"):
            return obj._precomputed_certificate_url
        user = context.get("request").user
        enrollment = obj.enrollments.filter(user=user).only("certificate_status", "certificate_file").first()
        if (
            enrollment
            and enrollment.certificate_status == "READY"
            and enrollment.certificate_file
        ):
            try:
                return enrollment.certificate_file.url
            except Exception:
                return None
        return None

    @staticmethod
    def resolve_is_owner(obj, context):
        user = context.get("request").user
        return obj.owner_id == getattr(user, "id", None)


class LessonSchema(ModelSchema):
    watched: bool = False

    class Meta:
        model = Lesson
        fields = [
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

    id: str = None

    @staticmethod
    def resolve_id(obj):
        return obj.short_id

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
            "module",
            "status",
        ]

    id: str = None

    @staticmethod
    def resolve_id(obj):
        return obj.short_id

    @staticmethod
    def resolve_watched(obj, context):
        user = context.get("request").user
        return obj.progress.filter(user=user, watched=True).exists()


ModuleSchema = create_schema(Module, fields=["name", "desc"])


class CourseIn(Schema):
    prompt: str
    level: CourseLevel
    num_modules: Optional[int] = 5


class ModuleDetailSchema(ModuleSchema):
    lessons: List[LessonSchema]
    quiz_id: Optional[str] = None
    quiz_title: Optional[str] = None
    last_quiz_score: Optional[float] = None
    last_quiz_passed: Optional[bool] = None
    material_status: Optional[str] = None
    material_pdf_url: Optional[str] = None
    material_content: Optional[str] = None

    @staticmethod
    def resolve_quiz_id(obj):
        return str(obj.quiz.uuid) if hasattr(obj, "quiz") else None

    @staticmethod
    def resolve_quiz_title(obj):
        return obj.quiz.title if hasattr(obj, "quiz") else None

    @staticmethod
    def resolve_last_quiz_score(obj):
        return getattr(obj, "_last_quiz_score", None)

    @staticmethod
    def resolve_last_quiz_passed(obj):
        return getattr(obj, "_last_quiz_passed", None)

    @staticmethod
    def resolve_material_status(obj):
        try:
            return obj.material.status
        except Exception:
            return None

    @staticmethod
    def resolve_material_pdf_url(obj):
        try:
            mat = obj.material
            if mat.status == "READY" and mat.pdf_file:
                return mat.pdf_file.url
        except Exception:
            pass
        return None

    @staticmethod
    def resolve_material_content(obj):
        try:
            return obj.material.content if obj.material.status == "READY" else None
        except Exception:
            return None

    id: str = None

    @staticmethod
    def resolve_id(obj):
        return str(obj.uuid)


class CourseDetailSchema(CourseOut):
    modules: List[ModuleDetailSchema]
    is_fully_completed: bool = False


class ChoiceSchema(ModelSchema):
    class Meta:
        model = Choice
        fields = ["text"]

    id: str = None

    @staticmethod
    def resolve_id(obj):
        return str(obj.uuid)


class QuestionSchema(ModelSchema):
    choices: List[ChoiceSchema]

    class Meta:
        model = Question
        fields = ["text"]

    id: str = None

    @staticmethod
    def resolve_id(obj):
        return str(obj.uuid)


class QuizSchema(ModelSchema):
    questions: List[QuestionSchema]

    class Meta:
        model = Quiz
        fields = ["title", "description"]

    id: str = None

    @staticmethod
    def resolve_id(obj):
        return str(obj.uuid)


class AnswerIn(Schema):
    question_id: str
    choice_id: str


class QuizSubmission(Schema):
    answers: List[AnswerIn]


class QuizResult(Schema):
    score: float
    passed: bool
    correct_answers: List[str]  # List of correct Choice UUIDs


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


class CourseShareOut(Schema):
    token: str
    course_id: str
    course_title: str
    sharer_name: str
    created_at: datetime


class ShareClaimOut(Schema):
    success: bool
    message: str
    course_id: Optional[str] = None


class ShareClaimListOut(Schema):
    recipient_name: str
    claimed_at: datetime


class ModuleMaterialSchema(Schema):
    status: str
    pdf_url: Optional[str] = None
    content: Optional[str] = None


# ── Public featured / discovery schemas ──────────────────────────────────────


class CourseFeaturedOut(Schema):
    """Lightweight card schema for the public community courses listing."""

    id: str
    title: Optional[str] = None
    level: Optional[str] = None
    thumb: Optional[str] = None
    desc: Optional[str] = None




class CoursePreviewLessonOut(Schema):
    title: str
    desc: str


class CoursePreviewModuleOut(Schema):
    id: str
    name: Optional[str] = None
    desc: Optional[str] = None
    lesson_count: int = 0
    lessons: List[CoursePreviewLessonOut] = []


class CoursePreviewOut(Schema):
    """Full detail schema for the public preview modal, no auth required."""

    id: str
    title: Optional[str] = None
    desc: Optional[str] = None
    level: Optional[str] = None
    thumb: Optional[str] = None
    owner_name: Optional[str] = None
    module_count: int = 0
    modules: List[CoursePreviewModuleOut] = []
