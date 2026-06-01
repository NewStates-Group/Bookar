from ninja.errors import HttpError
from django.db import IntegrityError
from mind_maps.models import MindMap
from mind_maps.services import MindMapService
from .models import Folha


class FolhaService:
    def __init__(self):
        self._mind_map_service = MindMapService()

    def _find_node(self, nodes, node_id):
        return self._mind_map_service._find_node(nodes, node_id)

    def _get_owned_folha(self, folha_uuid: str, user):
        try:
            return Folha.objects.select_related("mind_map").get(uuid=folha_uuid, user=user)
        except Folha.DoesNotExist:
            raise HttpError(404, "Folha não encontrada.")

    def _resolve_mind_map(self, mind_map_id: str, user):
        try:
            return MindMap.objects.get(uuid=mind_map_id, user=user)
        except MindMap.DoesNotExist:
            raise HttpError(404, "Mapa mental não encontrado.")

    def _validate_node_link(self, mind_map: MindMap, node_id: str):
        if not mind_map.nodes:
            raise HttpError(400, "O mapa mental ainda não possui nós.")
        if not self._find_node(mind_map.nodes, node_id):
            raise HttpError(404, f"Nó {node_id} não encontrado no mapa mental.")

    def list_folhas(self, user, mind_map_id: str | None = None, node_id: str | None = None):
        queryset = Folha.objects.filter(user=user).select_related("mind_map")
        if mind_map_id:
            queryset = queryset.filter(mind_map__uuid=mind_map_id)
        if node_id:
            queryset = queryset.filter(node_id=node_id)
        return queryset

    def get_folha(self, folha_uuid: str, user):
        return self._get_owned_folha(folha_uuid, user)

    def get_folha_for_node(self, user, mind_map_id: str, node_id: str):
        try:
            return Folha.objects.select_related("mind_map").get(
                user=user,
                mind_map__uuid=mind_map_id,
                node_id=node_id,
            )
        except Folha.DoesNotExist:
            raise HttpError(404, "Nenhuma folha associada a este nó.")

    def create_folha(
        self,
        user,
        title: str = "Folha em branco",
        content: str = "",
        mind_map_id: str | None = None,
        node_id: str | None = None,
    ):
        mind_map = None
        if mind_map_id or node_id:
            if not mind_map_id or not node_id:
                raise HttpError(400, "mind_map_id e node_id devem ser fornecidos em conjunto.")
            mind_map = self._resolve_mind_map(mind_map_id, user)
            self._validate_node_link(mind_map, node_id)

            existing = Folha.objects.filter(
                user=user, mind_map=mind_map, node_id=node_id
            ).first()
            if existing:
                return existing

        try:
            return Folha.objects.create(
                user=user,
                title=title or "Folha em branco",
                content=content or "",
                mind_map=mind_map,
                node_id=node_id,
            )
        except IntegrityError:
            if mind_map and node_id:
                return Folha.objects.get(user=user, mind_map=mind_map, node_id=node_id)
            raise HttpError(400, "Não foi possível criar a folha.")

    def update_folha(self, folha_uuid: str, user, title: str | None = None, content: str | None = None):
        folha = self._get_owned_folha(folha_uuid, user)
        if title is not None:
            folha.title = title
        if content is not None:
            folha.content = content
        folha.save()
        return folha

    def delete_folha(self, folha_uuid: str, user):
        folha = self._get_owned_folha(folha_uuid, user)
        folha.delete()
        return {"status": "success", "message": "Folha removida com sucesso."}
