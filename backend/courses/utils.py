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

limiter = RateLimiter(min_interval=settings.AI.get("GENAI_RATE_LIMIT", 5.0))

def is_retryable_error(exception):
    """Check if the error is 429 Resource Exhausted."""
    exc_str = str(exception).upper()
    if isinstance(exception, ClientError):
        # The error message usually contains 429 or RESOURCE_EXHAUSTED
        return "429" in exc_str or "RESOURCE_EXHAUSTED" in exc_str
    return "429" in exc_str or "RESOURCE_EXHAUSTED" in exc_str

@retry(
    retry=retry_if_exception_type(ClientError),
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


def get_next_lesson(course_pk: int) -> Lesson | None:
    return (
        Lesson.objects.filter(module__course_id=course_pk, watched=False)
        .order_by("module__created_at", "module__id", "id")
        .first()
    )
