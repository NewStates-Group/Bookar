import uuid

from django.conf import settings
from django.db import models


class Folha(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="folhas",
    )
    title = models.CharField(max_length=255, default="Folha em branco")
    content = models.TextField(blank=True, default="")
    mind_map = models.ForeignKey(
        "mind_maps.MindMap",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="folhas",
    )
    node_id = models.CharField(max_length=64, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "mind_map", "node_id"],
                condition=models.Q(mind_map__isnull=False)
                & models.Q(node_id__isnull=False),
                name="unique_folha_per_mind_map_node",
            )
        ]
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Folha: {self.title} ({self.user_id})"
