from django.core.cache import cache
from django.db import IntegrityError
from mind_maps.models import MindMap
from mind_maps.services import MindMapService
from ninja.errors import HttpError

from .models import Folha


def _folhas_list_cache_key(user_id, mind_map_id=None, node_id=None):
    return f"folhas_list_{user_id}_{mind_map_id or 'all'}_{node_id or 'all'}"


def _folha_detail_cache_key(folha_uuid: str):
    return f"folha_detail_{folha_uuid}"


def _folha_node_cache_key(user_id, mind_map_id: str, node_id: str):
    return f"folha_node_{user_id}_{mind_map_id}_{node_id}"


def invalidate_folha_cache(
    folha_uuid: str | None = None,
    user_id=None,
    mind_map_id: str | None = None,
    node_id: str | None = None,
):
    if folha_uuid:
        cache.delete(_folha_detail_cache_key(folha_uuid))
    if user_id is not None:
        cache.delete(_folhas_list_cache_key(user_id))
        cache.delete(_folhas_list_cache_key(user_id, mind_map_id))
        cache.delete(_folhas_list_cache_key(user_id, mind_map_id, node_id))
        if mind_map_id and node_id:
            cache.delete(_folha_node_cache_key(user_id, mind_map_id, node_id))


class FolhaService:
    def __init__(self):
        self._mind_map_service = MindMapService()

    def _find_node(self, nodes, node_id):
        return self._mind_map_service._find_node(nodes, node_id)

    def _get_owned_folha(self, folha_uuid: str, user):
        cache_key = _folha_detail_cache_key(folha_uuid)
        cached = cache.get(cache_key)
        if cached is not None and cached.user_id == user.id:
            return cached

        try:
            folha = Folha.objects.select_related("mind_map").get(
                uuid=folha_uuid, user=user
            )
            cache.set(cache_key, folha, 600)
            return folha
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

    def list_folhas(
        self, user, mind_map_id: str | None = None, node_id: str | None = None
    ):
        cache_key = _folhas_list_cache_key(user.id, mind_map_id, node_id)
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        queryset = (
            Folha.objects
            .filter(user=user)
            .select_related("mind_map")
            .only("uuid", "title", "content", "mind_map", "node_id", "created_at", "updated_at")
        )
        if mind_map_id:
            queryset = queryset.filter(mind_map__uuid=mind_map_id)
        if node_id:
            queryset = queryset.filter(node_id=node_id)
        folhas = list(queryset[:100])
        cache.set(cache_key, folhas, 300)
        return folhas

    def get_folha(self, folha_uuid: str, user):
        return self._get_owned_folha(folha_uuid, user)

    def get_folha_for_node(self, user, mind_map_id: str, node_id: str):
        cache_key = _folha_node_cache_key(user.id, mind_map_id, node_id)
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            folha = Folha.objects.select_related("mind_map").get(
                user=user,
                mind_map__uuid=mind_map_id,
                node_id=node_id,
            )
            cache.set(cache_key, folha, 600)
            cache.set(_folha_detail_cache_key(str(folha.uuid)), folha, 600)
            return folha
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
                raise HttpError(
                    400, "mind_map_id e node_id devem ser fornecidos em conjunto."
                )
            mind_map = self._resolve_mind_map(mind_map_id, user)
            self._validate_node_link(mind_map, node_id)

            existing = Folha.objects.filter(
                user=user, mind_map=mind_map, node_id=node_id
            ).first()
            if existing:
                return existing

        try:
            folha = Folha.objects.create(
                user=user,
                title=title or "Folha em branco",
                content=content or "",
                mind_map=mind_map,
                node_id=node_id,
            )
        except IntegrityError:
            if mind_map and node_id:
                folha = Folha.objects.get(user=user, mind_map=mind_map, node_id=node_id)
            else:
                raise HttpError(400, "Não foi possível criar a folha.")

        invalidate_folha_cache(
            folha_uuid=str(folha.uuid),
            user_id=user.id,
            mind_map_id=mind_map_id,
            node_id=node_id,
        )
        return folha

    def update_folha(
        self,
        folha_uuid: str,
        user,
        title: str | None = None,
        content: str | None = None,
    ):
        folha = self._get_owned_folha(folha_uuid, user)
        if title is not None:
            folha.title = title
        if content is not None:
            folha.content = content
        folha.save()

        mind_map_id = str(folha.mind_map.uuid) if folha.mind_map_id else None
        invalidate_folha_cache(
            folha_uuid=str(folha.uuid),
            user_id=user.id,
            mind_map_id=mind_map_id,
            node_id=folha.node_id,
        )
        return folha

    def delete_folha(self, folha_uuid: str, user):
        folha = self._get_owned_folha(folha_uuid, user)
        mind_map_id = str(folha.mind_map.uuid) if folha.mind_map_id else None
        node_id = folha.node_id
        folha.delete()

        invalidate_folha_cache(
            folha_uuid=folha_uuid,
            user_id=user.id,
            mind_map_id=mind_map_id,
            node_id=node_id,
        )
        return {"status": "success", "message": "Folha removida com sucesso."}
