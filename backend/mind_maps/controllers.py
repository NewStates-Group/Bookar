from typing import List
from injector import inject
from ninja_extra import api_controller, route
from ninja_jwt.authentication import JWTAuth
from .schemas import MindMapIn, MindMapOut
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
        return self.mind_map_service.create_mind_map(request.user, data.topic, data.language)

    @route.get("{mind_map_id}", response=MindMapOut)
    def get_mind_map(self, request, mind_map_id: str):
        return self.mind_map_service.get_mind_map(mind_map_id, request.user)

    @route.delete("{mind_map_id}")
    def delete_mind_map(self, request, mind_map_id: str):
        return self.mind_map_service.delete_mind_map(mind_map_id, request.user)
