from typing import List

from injector import inject
from ninja_extra import api_controller, route
from ninja_jwt.authentication import JWTAuth

from .schemas import (
    MindMapIn,
    MindMapOut,
    NodeContentOut,
    NoteUpdateIn,
    QuizOut,
    QuizSubmitIn,
)
from .services import MindMapService


@api_controller("mind-maps", tags=["MindMap"], auth=JWTAuth())
class MindMapController:
    @inject
    def __init__(self, mind_map_service: MindMapService):
        self.mind_map_service = mind_map_service

    @route.get("", response=List[MindMapOut])
    def list_mind_maps(self, request):
        return self.mind_map_service.list_mind_maps(request.user)

    @route.post("", response=MindMapOut)
    def create_mind_map(self, request, data: MindMapIn):
        return self.mind_map_service.create_mind_map(
            request.user, data.topic, data.language
        )

    @route.get("{mind_map_id}", response=MindMapOut)
    def get_mind_map(self, request, mind_map_id: str):
        return self.mind_map_service.get_mind_map(mind_map_id, request.user)

    @route.delete("{mind_map_id}")
    def delete_mind_map(self, request, mind_map_id: str):
        return self.mind_map_service.delete_mind_map(mind_map_id, request.user)

    @route.post("{mind_map_id}/share")
    def toggle_share(self, request, mind_map_id: str):
        return self.mind_map_service.toggle_share(mind_map_id, request.user)

    @route.post("{mind_map_id}/duplicate", response=MindMapOut)
    def duplicate_mind_map(self, request, mind_map_id: str):
        return self.mind_map_service.duplicate_mind_map(mind_map_id, request.user)

    @route.post("{mind_map_id}/node/{node_id}/skip")
    def skip_node(self, request, mind_map_id: str, node_id: str):
        return self.mind_map_service.skip_node(mind_map_id, node_id, request.user)

    @route.get("{mind_map_id}/node/{node_id}/content", response=NodeContentOut)
    def get_node_content(self, request, mind_map_id: str, node_id: str):
        return self.mind_map_service.get_node_content(
            mind_map_id, node_id, request.user
        )

    @route.get("{mind_map_id}/node/{node_id}/quiz", response=QuizOut)
    def get_node_quiz(self, request, mind_map_id: str, node_id: str):
        return self.mind_map_service.get_or_create_node_quiz(
            mind_map_id, node_id, request.user
        )

    @route.post("{mind_map_id}/node/{node_id}/quiz/submit")
    def submit_node_quiz(
        self, request, mind_map_id: str, node_id: str, data: QuizSubmitIn
    ):
        return self.mind_map_service.submit_node_quiz(
            mind_map_id, node_id, data.answers, request.user
        )

    @route.post("{mind_map_id}/node/{node_id}/note")
    def update_node_note(
        self, request, mind_map_id: str, node_id: str, data: NoteUpdateIn
    ):
        return self.mind_map_service.update_node_note(
            mind_map_id, node_id, data.content, request.user
        )
