from typing import Any, Dict, List, Optional

from ninja import ModelSchema, Schema

from .models import ExplicadorRoom


class ExplicadorCourseContextIn(Schema):
    course_id: Optional[str] = None
    course_title: Optional[str] = None
    module_name: Optional[str] = None
    lesson_id: Optional[str] = None
    lesson_title: Optional[str] = None
    lesson_description: Optional[str] = None
    narration: Optional[str] = None


class ExplicadorRoomCreateIn(Schema):
    title: str
    course_context: Optional[ExplicadorCourseContextIn] = None


class ExplicadorRoomOut(ModelSchema):
    id: str = None
    is_owner: Optional[bool] = None

    class Meta:
        model = ExplicadorRoom
        fields = [
            "title",
            "is_active",
            "created_at",
        ]

    @staticmethod
    def resolve_id(obj):
        return str(obj.uuid)


class ExplicadorRoomDetailOut(ExplicadorRoomOut):
    whiteboard_data: Optional[Dict[str, Any]] = None
    chat_history: Optional[List[Dict[str, Any]]] = None


class ExplicadorAskIn(Schema):
    message: str
    history: Optional[List[Dict[str, str]]] = None
    context: Optional[ExplicadorCourseContextIn] = None
