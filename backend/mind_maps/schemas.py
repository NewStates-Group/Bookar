from typing import List, Optional, Any
from ninja import ModelSchema, Schema
from .models import MindMap


class MindMapIn(Schema):
    topic: str
    language: Optional[str] = "pt"


class MindMapNode3Out(Schema):
    id: str
    level: int = 3
    title: str
    desc: str
    youtube_query: str
    youtube_url: Optional[str] = None
    youtube_embed: Optional[str] = None


class MindMapNode2Out(Schema):
    id: str
    level: int = 2
    title: str
    desc: str
    children: List[MindMapNode3Out]


class MindMapNode1Out(Schema):
    id: str
    level: int = 1
    title: str
    desc: str
    children: List[MindMapNode2Out]


class MindMapOut(ModelSchema):
    nodes: Optional[List[MindMapNode1Out]] = None
    id: str = None

    class Meta:
        model = MindMap
        fields = [
            "topic",
            "title",
            "desc",
            "status",
            "language",
            "created_at",
        ]

    @staticmethod
    def resolve_id(obj):
        return str(obj.uuid)
