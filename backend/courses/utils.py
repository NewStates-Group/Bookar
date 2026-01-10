import orjson
import re
from django.conf import settings
from google import genai
from ollama import Client as OllamaClient

from .models import Lesson


def extract_json(response: str):
    if not response:
        return None

    cleaned = re.sub(r"```(?:json)?", "", response).strip()
    decoder = orjson.JSONDecoder()

    for i in range(len(cleaned)):
        try:
            obj, _ = decoder.raw_decode(cleaned[i:])
            return obj
        except orjson.JSONDecodeError:
            continue
    raise orjson.JSONDecodeError("Falha ao decodificar")


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
