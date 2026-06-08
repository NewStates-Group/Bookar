import uuid

from django.conf import settings
from django.db import models


class ExplicadorRoom(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="explainer_rooms",
    )
    title = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["owner", "is_active", "-created_at"], name="idx_explic_owner_active"),
        ]

    # Stores the whiteboard configuration, like:
    # {
    #   "nodes": [
    #     {"id": "node1", "title": "React Hooks", "content": "Summary...", "type": "core", "x": 100, "y": 200}
    #   ],
    #   "edges": [
    #     {"id": "edge1", "from": "node1", "to": "node2", "label": "next"}
    #   ]
    # }
    whiteboard_data = models.JSONField(default=dict, blank=True)

    # Stores the chat messages list, like:
    # [
    #   {"role": "user", "content": "olá!"},
    #   {"role": "assistant", "content": "Olá, sou o explicador..."}
    # ]
    chat_history = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"ExplicadorRoom: {self.title} (Owner: {self.owner.email})"
