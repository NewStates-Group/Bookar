from typing import List
from injector import inject
from ninja_extra import api_controller, route
from ninja_jwt.authentication import JWTAuth
from ninja_jwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser

from .schemas import ExplicadorRoomCreateIn, ExplicadorRoomOut, ExplicadorRoomDetailOut
from .services import ExplicadorService

User = get_user_model()


@api_controller("explicador", tags=["Explicador"])
class ExplicadorController:

    @inject
    def __init__(self, explicador_service: ExplicadorService):
        self.explicador_service = explicador_service

    @route.get("", response=List[ExplicadorRoomOut], auth=JWTAuth())
    def list_rooms(self, request):
        """List explanation rooms owned by the logged-in user."""
        return self.explicador_service.list_rooms(request.user)

    @route.post("", response=ExplicadorRoomOut, auth=JWTAuth())
    def create_room(self, request, data: ExplicadorRoomCreateIn):
        """Create a new explanation room."""
        return self.explicador_service.create_room(request.user, data.title)

    @route.get("{room_uuid}", response=ExplicadorRoomDetailOut)
    def get_room(self, request, room_uuid: str):
        """
        Get details of an explanation room (public/guest endpoint).
        Resolves the user from JWT header manually if present.
        """
        user = AnonymousUser()
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token_str = auth_header.split(" ")[1]
            try:
                token = AccessToken(token_str)
                user_id = token.payload.get("user_id")
                user = User.objects.get(pk=user_id)
            except Exception:
                pass

        return self.explicador_service.get_room(room_uuid, user)

    @route.delete("{room_uuid}", auth=JWTAuth())
    def delete_room(self, request, room_uuid: str):
        """Delete an explanation room (restricted to owner)."""
        return self.explicador_service.delete_room(room_uuid, request.user)
