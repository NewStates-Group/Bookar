from django.db import models


class Tag(models.Model):
    name = models.CharField(max_lenght=80, null=True, blank=True)

class Course(models.Model):
    thumb = models.ImageField(upload_to="courses/thumbs/", null=True, blank=True)
    level = models.CharField(
        max_lenght=1,
        choices=[("I", "Iniciante"), ("IT", "Intermediário"), ("A", "Avançado")],
        null=True,
        blank=True,
    )
    title = models.CharField(max_lenght=80, null=True, blank=True)
    desc = models.TextField(null=True, blank=True)
    duration = models.CharField(max_lenght=15, null=True, blank=True)
    tags = models.ManyToManyField(Tag)
    # TERMINARS