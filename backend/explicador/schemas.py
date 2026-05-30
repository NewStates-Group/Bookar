from typing import Optional, List, Any, Dict
from ninja import ModelSchema, Schema
from .models import ExplicadorRoom


class ExplicadorRoomCreateIn(Schema):
    title: str


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
