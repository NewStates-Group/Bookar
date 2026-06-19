from asgiref.sync import sync_to_async
from django.core.cache import cache
from ninja.errors import HttpError

from .models import ExplicadorRoom


class ExplicadorService:
    async def list_rooms(self, user, q: str = ""):
        cache_key = f"explicador_rooms_{user.id}_{(q or '').strip()}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        qs = ExplicadorRoom.objects.filter(owner=user, is_active=True).order_by("-created_at").only(
            "uuid", "title", "is_active", "created_at"
        )
        search = (q or "").strip()
        if search:
            qs = qs.filter(title__icontains=search)

        result = await sync_to_async(lambda: list(qs[:50]))()
        for room in result:
            room.is_owner = True
        cache.set(cache_key, result, 60)
        return result

    async def create_room(self, user, title: str, course_context=None):
        whiteboard_data = {"summary": "", "lock": None}
        if course_context is not None:
            whiteboard_data["course_context"] = course_context

        room = await sync_to_async(ExplicadorRoom.objects.create)(
            owner=user,
            title=title,
            whiteboard_data=whiteboard_data,
            chat_history=[],
        )
        room.is_owner = True
        return room

    async def get_room(self, room_uuid: str, user):
        try:
            room = await sync_to_async(
                ExplicadorRoom.objects.select_related("owner").only(
                    "uuid", "title", "is_active", "created_at",
                    "whiteboard_data", "chat_history", "owner_id",
                ).get
            )(uuid=room_uuid)
        except (ExplicadorRoom.DoesNotExist, ValueError):
            raise HttpError(404, "Sala de explicação não encontrada.")

        is_owner = False
        if user and user.is_authenticated:
            is_owner = room.owner_id == user.id

        room.is_owner = is_owner
        return room

    async def delete_room(self, room_uuid: str, user):
        try:
            room = await sync_to_async(
                ExplicadorRoom.objects.only("uuid", "owner_id").get
            )(uuid=room_uuid)
        except (ExplicadorRoom.DoesNotExist, ValueError):
            raise HttpError(404, "Sala de explicação não encontrada.")

        if room.owner_id != user.id:
            raise HttpError(403, "Apenas o proprietário pode excluir esta sala.")

        await sync_to_async(room.delete)()
        return {"status": "success", "message": "Sala removida com sucesso."}
