import uuid

from django.db import models
from django.utils.text import slugify


class LevelChoices(models.TextChoices):
    BEGINNER = "I", "Iniciante"
    INTERMEDIATE = "IT", "Intermediário"
    ADVANCED = "A", "Avançado"


class Tag(models.Model):
    name = models.CharField(max_length=80, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)


class Course(models.Model):
    title = models.CharField(max_length=80, null=True, blank=True)
    desc = models.TextField(null=True, blank=True)
    level = models.CharField(
        max_length=2,
        choices=LevelChoices.choices,
        null=True,
        blank=True,
    )
    thumb = models.CharField(max_length=255, null=True, blank=True)
    duration = models.CharField(max_length=10, null=True, blank=True)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    # def save(self, *args, **kwargs):
    #    ...
    # slugify the title later


class Module(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    name = models.CharField(max_length=80, null=True, blank=True)
    desc = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)


class Lesson(models.Model):
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=150)
    desc = models.TextField()
    duration = models.PositiveIntegerField(default=0)
    watched = models.BooleanField(default=False)
    video_file = models.CharField(max_length=150, null=True, blank=True)
    narration = models.TextField(null=True, blank=True)
    key_points = models.CharField(max_length=150, null=True, blank=True)
    scene_suggestion = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
