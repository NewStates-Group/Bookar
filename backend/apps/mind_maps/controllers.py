from typing import List

from injector import inject
from ninja_extra import api_controller, route
from ninja_jwt.authentication import AsyncJWTAuth

from .schemas import (
    MindMapIn,
    MindMapOut,
    NodeContentOut,
    NoteUpdateIn,
    QuizOut,
    QuizSubmitIn,
)
from .services import MindMapService


@api_controller("mind-maps", tags=["MindMap"], auth=AsyncJWTAuth())
class MindMapController:
    @inject
    def __init__(self, mind_map_service: MindMapService):
        self.mind_map_service = mind_map_service

    @route.get("", response=List[dict])
    async def list_mind_maps(self, request):
        return await self.mind_map_service.list_mind_maps(request.user)

    @route.post("", response=MindMapOut)
    async def create_mind_map(self, request, data: MindMapIn):
        return await self.mind_map_service.create_mind_map(
            request.user, data.topic, data.language
        )

    @route.get("{mind_map_id}", response=MindMapOut)
    async def get_mind_map(self, request, mind_map_id: str):
        return await self.mind_map_service.get_mind_map(mind_map_id, request.user)

    @route.delete("{mind_map_id}")
    async def delete_mind_map(self, request, mind_map_id: str):
        return await self.mind_map_service.delete_mind_map(mind_map_id, request.user)

    @route.post("{mind_map_id}/share")
    async def toggle_share(self, request, mind_map_id: str):
        return await self.mind_map_service.toggle_share(mind_map_id, request.user)

    @route.post("{mind_map_id}/duplicate", response=MindMapOut)
    async def duplicate_mind_map(self, request, mind_map_id: str):
        return await self.mind_map_service.duplicate_mind_map(mind_map_id, request.user)

    @route.post("{mind_map_id}/node/{node_id}/skip")
    async def skip_node(self, request, mind_map_id: str, node_id: str):
        return await self.mind_map_service.skip_node(mind_map_id, node_id, request.user)

    @route.get("{mind_map_id}/node/{node_id}/content", response=NodeContentOut)
    async def get_node_content(self, request, mind_map_id: str, node_id: str):
        return await self.mind_map_service.get_node_content(
            mind_map_id, node_id, request.user
        )

    @route.get("{mind_map_id}/node/{node_id}/quiz", response=QuizOut)
    async def get_node_quiz(self, request, mind_map_id: str, node_id: str):
        return await self.mind_map_service.get_or_create_node_quiz(
            mind_map_id, node_id, request.user
        )

    @route.post("{mind_map_id}/node/{node_id}/quiz/submit")
    async def submit_node_quiz(
        self, request, mind_map_id: str, node_id: str, data: QuizSubmitIn
    ):
        return await self.mind_map_service.submit_node_quiz(
            mind_map_id, node_id, data.answers, request.user
        )

    @route.post("{mind_map_id}/node/{node_id}/note")
    async def update_node_note(
        self, request, mind_map_id: str, node_id: str, data: NoteUpdateIn
    ):
        return await self.mind_map_service.update_node_note(
            mind_map_id, node_id, data.content, request.user
        )
