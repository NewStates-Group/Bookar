from typing import List, Optional

from injector import inject
from ninja_extra import api_controller, route
from ninja_jwt.authentication import AsyncJWTAuth

from .schemas import FolhaCreateIn, FolhaOut, FolhaUpdateIn
from .services import FolhaService


@api_controller("folhas", tags=["Folhas"], auth=AsyncJWTAuth())
class FolhaController:
    @inject
    def __init__(self, folha_service: FolhaService):
        self.folha_service = folha_service

    @route.get("", response=List[FolhaOut])
    async def list_folhas(
        self,
        request,
        mind_map_id: Optional[str] = None,
        node_id: Optional[str] = None,
    ):
        return await self.folha_service.list_folhas(request.user, mind_map_id, node_id)

    @route.get("lookup", response=FolhaOut)
    async def lookup_folha_for_node(self, request, mind_map_id: str, node_id: str):
        return await self.folha_service.get_folha_for_node(request.user, mind_map_id, node_id)

    @route.post("", response=FolhaOut)
    async def create_folha(self, request, data: FolhaCreateIn):
        return await self.folha_service.create_folha(
            request.user,
            title=data.title or "Folha em branco",
            content=data.content or "",
            mind_map_id=data.mind_map_id,
            node_id=data.node_id,
        )

    @route.get("{folha_id}", response=FolhaOut)
    async def get_folha(self, request, folha_id: str):
        return await self.folha_service.get_folha(folha_id, request.user)

    @route.patch("{folha_id}", response=FolhaOut)
    async def update_folha(self, request, folha_id: str, data: FolhaUpdateIn):
        return await self.folha_service.update_folha(
            folha_id,
            request.user,
            title=data.title,
            content=data.content,
        )

    @route.delete("{folha_id}")
    async def delete_folha(self, request, folha_id: str):
        return await self.folha_service.delete_folha(folha_id, request.user)
