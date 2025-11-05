from django.db import models


class LevelChoices(models.TextChoices):
    BEGINNER = "I", "Iniciante"
    INTERMEDIATE = "IT", "Intermediário"
    ADVANCED = "A", "Avançado"


class Tag(models.Model):
    name = models.CharField(max_length=80, null=True, blank=True)


class Course(models.Model):
    thumb = models.ImageField(upload_to="courses/thumbs/", null=True, blank=True)
    level = models.CharField(
        max_length=2,
        choices=LevelChoices.choices,
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=80, null=True, blank=True)
    desc = models.TextField(null=True, blank=True)
    duration = models.CharField(max_length=10, null=True, blank=True)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)
    modules = models.ManyToManyField("Module")
    created_at = models.DateTimeField(auto_now_add=True)


class Module(models.Model):
    name = models.CharField(max_length=80, null=True, blank=True)
    desc = models.TextField(null=True, blank=True)
    lessons = models.ManyToManyField("Lesson", related_name="modules")
    order = models.PositiveIntegerField(default=0, null=True, blank=True)


class Lesson(models.Model):
    title = models.CharField(max_length=80, null=True, blank=True)
    desc = models.TextField(null=True, blank=True)
    duraction = models.PositiveIntegerField(default=0, null=True, blank=True)
    watched = models.BooleanField(default=False, null=True, blank=True)
    video_file = models.FileField(upload_to="courses/videos/", null=True, blank=True)
    narration = models.TextField(null=True, blank=True)
    key_points = models.JSONField(null=True, blank=True)
    scene_suggestion = models.TextField(null=True, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
