from typing import Any, List, Optional

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
    completed_nodes: Optional[List[str]] = None
    notes: Optional[dict] = None
    id: str = None
    is_shared: bool = False
    is_owner: Optional[bool] = None
    import_count: int = 0

    class Meta:
        model = MindMap
        fields = [
            "uuid",
            "topic",
            "title",
            "desc",
            "status",
            "language",
            "completed_nodes",
            "notes",
            "created_at",
            "is_shared",
            "import_count",
        ]

    @staticmethod
    def resolve_id(obj):
        return str(obj.uuid)


class NodeContentOut(Schema):
    text_content: str
    additional_resources: Optional[List[Any]] = None


class QuizQuestionOut(Schema):
    id: int
    type: str  # multiple_choice, true_false, short_answer
    question: str
    options: Optional[List[str]] = None


class QuizOut(Schema):
    questions: List[QuizQuestionOut]


class QuizSubmitIn(Schema):
    answers: dict


class NoteUpdateIn(Schema):
    content: str
