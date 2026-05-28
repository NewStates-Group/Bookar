import uuid
from django.db import models
from django.conf import settings


class MindMapStatus(models.TextChoices):
    PROCESSING = "PROCESSING", "Processando"
    READY = "READY", "Pronto"
    FAILED = "FAILED", "Falhou"


class MindMap(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mind_maps",
    )
    topic = models.CharField(max_length=255)
    title = models.CharField(max_length=255, null=True, blank=True)
    desc = models.TextField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=MindMapStatus.choices,
        default=MindMapStatus.PROCESSING,
    )
    # JSON structure storing learning nodes:
    # [
    #   {
    #     "id": "1",
    #     "title": "Intro to topic",
    #     "desc": "Detail description",
    #     "youtube_query": "search query",
    #     "youtube_url": "resolved url",
    #     "youtube_embed": "resolved embed url",
    #     "dependencies": []
    #   }
    # ]
    language = models.CharField(max_length=10, default="pt")
    is_shared = models.BooleanField(default=False)
    import_count = models.PositiveIntegerField(default=0)
    nodes = models.JSONField(null=True, blank=True)
    completed_nodes = models.JSONField(default=list, blank=True)
    notes = models.JSONField(default=dict, blank=True)
    quizzes = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"MindMap: {self.title or self.topic} ({self.status})"
