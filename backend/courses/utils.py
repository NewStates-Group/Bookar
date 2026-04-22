import logging
import time
import orjson
from django.conf import settings
from openai import OpenAI
from ollama import Client as OllamaClient
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from .models import Lesson

logger = logging.getLogger(__name__)

import threading


# Simple rate limiter state
class RateLimiter:
    def __init__(self, min_interval=1.0):
        self.min_interval = min_interval
        self.last_call = 0
        self._lock = threading.Lock()

    def wait(self):
        with self._lock:
            now = time.time()
            elapsed = now - self.last_call
            if elapsed < self.min_interval:
                time.sleep(self.min_interval - elapsed)
            self.last_call = time.time()


limiter = RateLimiter(min_interval=settings.AI.get("GENAI_RATE_LIMIT", 5.0))


def is_retryable_error(exception):
    """Check if the error is 429 Resource Exhausted."""
    exc_str = str(exception).upper()
    # ClientError was from google-genai, now we check generic exceptions for 429
    if hasattr(exception, "status_code"):
        return exception.status_code == 429
    return "429" in exc_str or "RESOURCE_EXHAUSTED" in exc_str


@retry(
    retry=retry_if_exception_type(Exception),
    wait=wait_exponential(multiplier=2, min=15, max=120),
    stop=stop_after_attempt(5),
    reraise=True,
)
def safe_gemini_call(method, *args, **kwargs):
    """
    Safe wrapper for Gemini API calls with rate limiting and exponential backoff.
    """
    limiter.wait()
    try:
        # If it's the generate_content method, it might be bound to the model
        return method(*args, **kwargs)
    except Exception as e:
        if is_retryable_error(e):
            logger.warning(f"Gemini API rate limit hit, retrying: {e}")
        # Re-raise as a standard Exception if needed to avoid unpickleable exception in Celery
        # if though we want to keep it if we catch it later
        raise e


def extract_json(response: str, isList: bool = False):
    if not response:
        return None

    cleaned = response.strip()

    # Remove markdown code blocks if present
    if "```" in cleaned:
        import re

        # Try to find content between ```json and ```
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
        if match:
            cleaned = match.group(1).strip()

    try:
        start_bracket = cleaned.find("{" if not isList else "[")
        end_bracket = cleaned.rfind("}" if not isList else "]")

        if start_bracket == -1 or end_bracket == -1:
            logger.error(f"Brackets not found in response: {cleaned[:100]}...")
            return None

        json_str = cleaned[start_bracket : end_bracket + 1]

        # Try orjson first for speed
        try:
            return orjson.loads(json_str)
        except orjson.JSONDecodeError:
            # Fallback to standard json which is sometimes more lenient with trailing commans in some setups
            # or just to provide a second chance
            import json

            return json.loads(json_str)

    except Exception as e:
        logger.error(f"Failed to extract JSON from response: {e}")
        logger.debug(f"Raw response for failure: {response}")
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


def get_openrouter_client():
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.AI["OPENROUTER_KEY"],
    )


def openrouter_chat(messages, model=None):
    client = get_openrouter_client()
    if model is None:
        model = settings.AI.get("OPENROUTER_MODEL_TEXT", "google/gemma-4-26b-a4b-it:free")

    # Adapt if messages is a string or list of dicts
    if isinstance(messages, str):
        msgs = [{"role": "user", "content": messages}]
    else:
        msgs = messages

    response = client.chat.completions.create(
        model=model,
        messages=msgs,
    )

    return response.choices[0].message.content


def genai_chat(messages, model=None):
    """
    Backwards compatibility: redirects to OpenRouter as requested.
    """
    return openrouter_chat(messages, model=model)


def cached_genai_call(prompt: str, ttl: int = 86400) -> str:
    """
    Cache Gemini text responses in Redis for 24h.
    Prevents re-generating identical content (same topic, same lesson structure).
    """
    import hashlib
    from django.core.cache import cache

    key = "genai:" + hashlib.md5(prompt.encode()).hexdigest()
    cached = cache.get(key)
    if cached:
        logger.info("Cache HIT for Gemini prompt")
        return cached
    result = genai_chat([{"role": "user", "content": prompt}])
    cache.set(key, result, ttl)
    return result


def get_course_list_cache_key(user_id):
    return f"course_list_{user_id}"


def get_course_detail_cache_key(course_uuid):
    return f"course_detail_{course_uuid}"


def get_lesson_detail_cache_key(lesson_short_id):
    return f"lesson_detail_{lesson_short_id}"


def invalidate_course_cache(course_uuid, user_id=None):
    from django.core.cache import cache

    cache.delete(get_course_detail_cache_key(course_uuid))
    if user_id:
        cache.delete(get_course_list_cache_key(user_id))
