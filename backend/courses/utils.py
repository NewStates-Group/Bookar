import orjson
from django.conf import settings
from google import genai
from ollama import Client as OllamaClient

from .models import Lesson


def extract_json(response: str, isList: bool = False):
    cleaned = response.strip()
    start_bracket = cleaned.index("{" if not isList else "[")
    end_bracket = cleaned.rindex("}" if not isList else "]")
    cleaned = cleaned[start_bracket : end_bracket + 1]
    return orjson.loads(cleaned)


def get_ollama_client():
    return OllamaClient(
        host="https://ollama.com",
        headers={"Authorization": "Bearer " + settings.AI["OLLAMA_KEY"]},
    )


def ollama_chat(*args, **kwargs):
    client = get_ollama_client()
    return client.chat(settings.AI["OLLAMA_MODEL_TEXT"], *args, **kwargs)["message"][
        "content"
    ]


def get_genai_client():
    return genai.Client(api_key=settings.AI["GENAI_KEY"])


def get_next_lesson(course_pk: int) -> Lesson | None:
    return (
        Lesson.objects.filter(module__course_id=course_pk, watched=False)
        .order_by("module__created_at", "module__id", "id")
        .first()
    )
