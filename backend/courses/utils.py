import logging
import time
import orjson
from django.conf import settings
from google import genai
from google.genai.errors import ClientError
from ollama import Client as OllamaClient
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from .models import Lesson

logger = logging.getLogger(__name__)

# Simple rate limiter state
class RateLimiter:
    def __init__(self, min_interval=1.0):
        self.min_interval = min_interval
        self.last_call = 0

    def wait(self):
        now = time.time()
        elapsed = now - self.last_call
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self.last_call = time.time()

limiter = RateLimiter(min_interval=settings.AI.get("GENAI_RATE_LIMIT", 1.0))

def is_retryable_error(exception):
    """Check if the error is 429 Resource Exhausted."""
    if isinstance(exception, ClientError):
        # The error message usually contains 429 or RESOURCE_EXHAUSTED
        return "429" in str(exception) or "RESOURCE_EXHAUSTED" in str(exception)
    return False

@retry(
    retry=retry_if_exception_type(ClientError),
    wait=wait_exponential(multiplier=1, min=4, max=60),
    stop=stop_after_attempt(5),
    reraise=True,
)
def safe_gemini_call(method, *args, **kwargs):
    """
    Safe wrapper for Gemini API calls with rate limiting and exponential backoff.
    """
    limiter.wait()
    try:
        return method(*args, **kwargs)
    except Exception as e:
        if is_retryable_error(e):
            logger.warning(f"Gemini API rate limit hit, retrying: {e}")
        raise e

def extract_json(response: str, isList: bool = False):
    cleaned = response.strip()
    try:
        start_bracket = cleaned.index("{" if not isList else "[")
        end_bracket = cleaned.rindex("}" if not isList else "]")
        cleaned = cleaned[start_bracket : end_bracket + 1]
        return orjson.loads(cleaned)
    except (ValueError, orjson.JSONDecodeError) as e:
        logger.error(f"Failed to extract JSON from response: {e}")
        return None


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

    response = safe_gemini_call(
        client.models.generate_content,
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
