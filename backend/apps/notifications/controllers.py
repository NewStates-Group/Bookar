from typing import List

from injector import inject
from ninja_extra import api_controller, route
from ninja_jwt.authentication import AsyncJWTAuth

from .schemas import NotificationOut, UnreadCountOut
from .services import NotificationService


@api_controller("notifications", tags=["Notifications"], auth=AsyncJWTAuth())
class NotificationController:
    @inject
    def __init__(self, service: NotificationService):
        self.service = service

    @route.get("", response=List[NotificationOut])
    async def list_notifications(self, request):
        return await self.service.list_notifications(request.user)

    @route.get("unread-count", response=UnreadCountOut)
    async def unread_count(self, request):
        count = await self.service.get_unread_count(request.user)
        return {"count": count}

    @route.post("{notification_id}/read")
    async def mark_read(self, request, notification_id: int):
        await self.service.mark_read(notification_id, request.user)
        return {"success": True}

    @route.post("read-all")
    async def mark_all_read(self, request):
        await self.service.mark_all_read(request.user)
        return {"success": True}
