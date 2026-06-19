from datetime import datetime

from ninja import Schema


class NotificationOut(Schema):
    id: int
    title: str
    message: str
    type: str
    link: str
    is_read: bool
    created_at: datetime


class UnreadCountOut(Schema):
    count: int
