from typing import Optional
from ninja import ModelSchema, Schema
from .models import Folha


class FolhaCreateIn(Schema):
    title: Optional[str] = "Folha em branco"
    content: Optional[str] = ""
    mind_map_id: Optional[str] = None
    node_id: Optional[str] = None


class FolhaUpdateIn(Schema):
    title: Optional[str] = None
    content: Optional[str] = None


class FolhaOut(ModelSchema):
    id: str = None
    mind_map_id: Optional[str] = None
    mind_map_title: Optional[str] = None
    node_id: Optional[str] = None

    class Meta:
        model = Folha
        fields = ["title", "content", "node_id", "created_at", "updated_at"]

    @staticmethod
    def resolve_id(obj):
        return str(obj.uuid)

    @staticmethod
    def resolve_mind_map_id(obj):
        return str(obj.mind_map.uuid) if obj.mind_map_id else None

    @staticmethod
    def resolve_mind_map_title(obj):
        if not obj.mind_map_id:
            return None
        return obj.mind_map.title or obj.mind_map.topic
