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


def genai_chat(messages, model=None):
    client = get_genai_client()
    if model is None:
        model = settings.AI.get("GENAI_MODEL_TEXT", "gemini-2.0-flash")
    
    # Extract content from the last message if it's a list of dicts (Ollama style)
    if isinstance(messages, list) and len(messages) > 0 and isinstance(messages[-1], dict):
        prompt = messages[-1].get("content", "")
    else:
        prompt = str(messages)

    response = client.models.generate_content(
        model=model,
        contents=prompt,
    )
    
    return response.text


def get_next_lesson(course_pk: int) -> Lesson | None:
    return (
        Lesson.objects.filter(module__course_id=course_pk, watched=False)
        .order_by("module__created_at", "module__id", "id")
        .first()
    )
