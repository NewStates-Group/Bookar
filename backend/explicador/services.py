from ninja.errors import HttpError
from django.contrib.auth import get_user_model
from .models import ExplicadorRoom

User = get_user_model()


class ExplicadorService:

    def list_rooms(self, user):
        """List all active rooms owned by the user."""
        queryset = ExplicadorRoom.objects.filter(owner=user, is_active=True).order_by("-created_at")
        for room in queryset:
            room.is_owner = True
        return queryset

    def create_room(self, user, title: str):
        """Create a new explicador room."""
        room = ExplicadorRoom.objects.create(
            owner=user,
            title=title,
            whiteboard_data={
                "summary": "",
                "lock": None,
            },
            chat_history=[],
        )
        room.is_owner = True
        return room

    def get_room(self, room_uuid: str, user):
        """Retrieve details of a room by public UUID. Works for owner and guests."""
        try:
            room = ExplicadorRoom.objects.get(uuid=room_uuid)
        except (ExplicadorRoom.DoesNotExist, ValueError):
            raise HttpError(404, "Sala de explicação não encontrada.")

        # Determine if current user is owner
        # If user is anonymous, is_owner will be False
        is_owner = False
        if user and user.is_authenticated:
            is_owner = (room.owner == user)
        
        room.is_owner = is_owner
        return room

    def delete_room(self, room_uuid: str, user):
        """Deactivate or delete a room (restricted to owner)."""
        try:
            room = ExplicadorRoom.objects.get(uuid=room_uuid)
        except (ExplicadorRoom.DoesNotExist, ValueError):
            raise HttpError(404, "Sala de explicação não encontrada.")

        if room.owner != user:
            raise HttpError(403, "Apenas o proprietário pode excluir esta sala.")

        room.delete()
        return {"status": "success", "message": "Sala removida com sucesso."}
