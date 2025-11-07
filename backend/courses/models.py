from django.db import models
from django.utils.text import slugify


class LevelChoices(models.TextChoices):
    BEGINNER = "I", "Iniciante"
    INTERMEDIATE = "IT", "Intermediário"
    ADVANCED = "A", "Avançado"


class Tag(models.Model):
    name = models.CharField(max_length=80, null=True, blank=True)


class Course(models.Model):
    thumb = models.CharField(max_length=150, null=True, blank=True)
    level = models.CharField(
        max_length=2,
        choices=LevelChoices.choices,
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=80, null=True, blank=True)
    slug = models.SlugField(null=True, blank=True)
    desc = models.TextField(null=True, blank=True)
    duration = models.CharField(max_length=10, null=True, blank=True)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)
    modules = models.ManyToManyField("Module")
    created_at = models.DateTimeField(auto_now_add=True)
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(f"{self.title}-{self.pk}")
        return super().save(*args, **kwargs)

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
    video_file = models.CharField(max_length=150, null=True, blank=True)
    narration = models.TextField(null=True, blank=True)
    key_points = models.JSONField(null=True, blank=True)
    scene_suggestion = models.TextField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
