from celery import shared_task
from elevenlabs.client import ElevenLabs
from django.conf import settings
from .models import Lesson

elevenlabs_client = ElevenLabs(api_key=settings.ELEVENLABS_SECRET_KEY)


@shared_task
def generate_lesson(lesson: Lesson):
    ...
    # generate and change the video_file
