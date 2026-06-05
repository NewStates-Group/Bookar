from cloudinary_storage.storage import MediaCloudinaryStorage
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, unique=True, blank=True, null=True)
    avatar = models.ImageField(
        upload_to="avatars/", null=True, blank=True, storage=MediaCloudinaryStorage()
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []


class EmailVerificationCode(models.Model):
    email = models.EmailField()
    code = models.CharField(max_length=6)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.email} - {self.code}"


class Waitlist(models.Model):
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.email
