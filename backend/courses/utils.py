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
    retry_if_exception,
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
    return "429" in exc_str or "RESOURCE_EXHAUSTED" in exc_str or "503" in exc_str


@retry(
    retry=retry_if_exception(is_retryable_error),
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
        # Re-raise as a standard Exception if needed to avoid unpickleable ClientError in Celery
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


def get_genai_client():
    return genai.Client(api_key=settings.AI["GENAI_KEY"])


def genai_chat(messages, model=None):
    client = get_genai_client()
    if model is None:
        model = settings.AI.get("GENAI_MODEL_TEXT", "gemini-2.5-flash-lite")

    # Extract content from the last message if it's a list of dicts (Ollama style)
    if (
        isinstance(messages, list)
        and len(messages) > 0
        and isinstance(messages[-1], dict)
    ):
        prompt = messages[-1].get("content", "")
    else:
        prompt = str(messages)

    response = safe_gemini_call(
        client.models.generate_content,
        model=model,
        contents=prompt,
    )

    return response.text


def generate_text_with_fallback(messages, model=None):
    """
    Wrapper for text generation with fallback chain (GenAI <-> Ollama).
    Behavior changes based on AI_ENVIRONMENT setting.
    """
    env = settings.AI.get("AI_ENVIRONMENT", "production")
    
    def call_genai():
        return genai_chat(messages, model)
        
    def call_ollama():
        if isinstance(messages, list):
            return ollama_chat(messages=messages)
        else:
            return ollama_chat(messages=[{"role": "user", "content": str(messages)}])
            
    if env == "testing":
        providers = [
            ("Ollama", call_ollama), 
            ("GenAI", call_genai)
        ]
    else:
        providers = [
            ("GenAI", call_genai), 
            ("Ollama", call_ollama)
        ]

    last_error = None
    for name, provider in providers:
        try:
            logger.info(f"Attempting text generation with provider: {name}")
            return provider()
        except Exception as e:
            logger.warning(f"Text provider {name} failed: {e}")
            last_error = e
            
    raise RuntimeError(f"All text providers failed. Last error: {last_error}")


def cached_genai_call(prompt: str, ttl: int = 86400) -> str:
    """
    Cache textual responses in Redis for 24h.
    Prevents re-generating identical content (same topic, same lesson structure).
    """
    import hashlib
    from django.core.cache import cache

    key = "genai:" + hashlib.md5(prompt.encode()).hexdigest()
    cached = cache.get(key)
    if cached:
        logger.info("Cache HIT for text prompt")
        return cached
    result = generate_text_with_fallback([{"role": "user", "content": prompt}])
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


def invalidate_course_cache(course_uuid, user_id=None):
    from django.core.cache import cache

    cache.delete(get_course_detail_cache_key(course_uuid))
    if user_id:
        cache.delete(get_course_list_cache_key(user_id))
