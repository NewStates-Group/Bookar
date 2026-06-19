import asyncio
import logging
import threading
import time

import orjson
from asgiref.sync import sync_to_async
from django.conf import settings
from google import genai
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)


logger = logging.getLogger(__name__)


# Simple rate limiter state
class RateLimiter:
    def __init__(self, min_interval=1.0):
        self.min_interval = min_interval
        self.last_call = 0
        self._lock = threading.Lock()
        self._async_lock = asyncio.Lock()

    def wait(self):
        with self._lock:
            now = time.time()
            elapsed = now - self.last_call
            if elapsed < self.min_interval:
                time.sleep(self.min_interval - elapsed)
            self.last_call = time.time()

    async def wait_async(self):
        async with self._async_lock:
            now = time.time()
            elapsed = now - self.last_call
            if elapsed < self.min_interval:
                await asyncio.sleep(self.min_interval - elapsed)
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
        return method(*args, **kwargs)
    except Exception as e:
        if is_retryable_error(e):
            logger.warning(f"Gemini API rate limit hit, retrying: {e}")
        raise e


@retry(
    retry=retry_if_exception(is_retryable_error),
    wait=wait_exponential(multiplier=2, min=15, max=120),
    stop=stop_after_attempt(5),
    reraise=True,
)
async def safe_gemini_call_async(method, *args, **kwargs):
    """
    Async safe wrapper for Gemini API calls with rate limiting and exponential backoff.
    """
    await limiter.wait_async()
    try:
        return await method(*args, **kwargs)
    except Exception as e:
        if is_retryable_error(e):
            logger.warning(f"Gemini API rate limit hit, retrying: {e}")
        raise e


def extract_json(response: str, isList: bool = False):
    if not response:
        return None

    cleaned = response.strip()

    # Remove markdown code blocks if present
    if "```" in cleaned:
        import re

        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
        if match:
            cleaned = match.group(1).strip()
        else:
            # If the closing backticks are missing (truncated), strip the opening ones
            match_incomplete = re.search(r"```(?:json)?\s*([\s\S]*)$", cleaned)
            if match_incomplete:
                cleaned = match_incomplete.group(1).strip()

    # Helper function to auto-repair truncated JSON objects
    def repair_json_str(s: str) -> str:
        s = s.strip()
        if not s:
            return s
        if not s.startswith("{") and not s.startswith("["):
            # Try to find first opening bracket
            first_brace = s.find("{")
            first_bracket = s.find("[")
            if first_brace != -1 and (
                first_bracket == -1 or first_brace < first_bracket
            ):
                s = s[first_brace:]
            elif first_bracket != -1:
                s = s[first_bracket:]

        # Detect if we are inside a string (odd quotes count)
        in_string = False
        escape = False
        for char in s:
            if escape:
                escape = False
                continue
            if char == "\\":
                escape = True
            elif char == '"':
                in_string = not in_string

        if in_string:
            s += '"'

        s = s.strip()
        if s.endswith(","):
            s = s[:-1].strip()

        # Balance braces
        if s.startswith("{") and not s.endswith("}"):
            s += "}"
        elif s.startswith("[") and not s.endswith("]"):
            s += "]"
        return s

    # 1. Standard parsing try
    try:
        start_bracket = cleaned.find("{" if not isList else "[")
        end_bracket = cleaned.rfind("}" if not isList else "]")

        if start_bracket != -1 and end_bracket != -1:
            json_str = cleaned[start_bracket : end_bracket + 1]
            try:
                return orjson.loads(json_str)
            except Exception:
                import json

                try:
                    return json.loads(json_str)
                except Exception:
                    pass

    except Exception:
        pass

    # 2. Try standard parsing on repaired string
    repaired = repair_json_str(cleaned)
    if repaired:
        try:
            return orjson.loads(repaired)
        except Exception:
            import json

            try:
                return json.loads(repaired)
            except Exception:
                pass

    # 3. Regex Fallback: If JSON is completely mangled or truncated, extract fields manually
    if not isList:
        import json
        import re

        logger.warning(
            "Attempting regex fallback to extract text_content from incomplete JSON."
        )

        # Try matching complete string with escaped quotes/newlines
        text_match = re.search(r'"text_content"\s*:\s*"((?:[^"\\]|\\.)*)"', cleaned)
        if text_match:
            try:
                text_val = json.loads('"' + text_match.group(1) + '"')
                # Try matching resources array
                resources_match = re.search(
                    r'"additional_resources"\s*:\s*(\[[\s\S]*?\])', cleaned + "]}"
                )
                resources_val = []
                if resources_match:
                    try:
                        resources_val = json.loads(resources_match.group(1))
                    except Exception:
                        items = re.findall(
                            r'\{\s*"title"\s*:\s*"([^"]*)"\s*,\s*"url"\s*:\s*"([^"]*)"\s*\}',
                            cleaned,
                        )
                        for title, url in items:
                            resources_val.append({"title": title, "url": url})
                return {"text_content": text_val, "additional_resources": resources_val}
            except Exception as e:
                logger.error(f"Regex complete match extraction failed: {e}")

        # Try matching truncated string to the end of the response
        text_match_incomplete = re.search(r'"text_content"\s*:\s*"([\s\S]*)$', cleaned)
        if text_match_incomplete:
            try:
                raw_text = text_match_incomplete.group(1)
                # Cleanup any trailing JSON residues like ", "additional_resources": ...
                # Stop at the next unescaped double quote if present
                quote_idx = -1
                escape = False
                for idx, c in enumerate(raw_text):
                    if escape:
                        escape = False
                        continue
                    if c == "\\":
                        escape = True
                    elif c == '"':
                        quote_idx = idx
                        break
                if quote_idx != -1:
                    raw_text = raw_text[:quote_idx]

                # Unescape manually
                text_val = (
                    raw_text.replace('\\"', '"')
                    .replace("\\n", "\n")
                    .replace("\\t", "\t")
                    .strip()
                )
                if text_val.endswith('"'):
                    text_val = text_val[:-1]
                return {"text_content": text_val, "additional_resources": []}
            except Exception as e:
                logger.error(f"Regex incomplete match extraction failed: {e}")

    logger.error(
        f"Failed to extract JSON even with fallbacks from response: {response[:150]}..."
    )
    return None


def get_genai_client():
    return genai.Client(api_key=settings.AI["GENAI_KEY"])


def generate_text_with_fallback(messages, model=None):
    """
    Text generation with Chain of Responsibility fallback (sync, for Celery tasks).
    """
    from .providers import get_text_chain

    chain = get_text_chain()
    return chain.handle(messages=messages, model=model)


async def generate_text_with_fallback_async(messages, model=None):
    """
    Text generation with Chain of Responsibility fallback (async, for async views/services).
    """
    from .providers import get_text_chain

    chain = get_text_chain()
    return await chain.handle_async(messages=messages, model=model)


def cached_genai_call(prompt: str, ttl: int = 86400) -> str:
    """
    Cache textual responses in Redis for 24h (sync).
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


async def cached_genai_call_async(prompt: str, ttl: int = 86400) -> str:
    """
    Cache textual responses in Redis for 24h (async).
    """
    import hashlib

    from django.core.cache import cache

    key = "genai:" + hashlib.md5(prompt.encode()).hexdigest()
    cached = await sync_to_async(cache.get)(key)
    if cached:
        logger.info("Cache HIT for text prompt")
        return cached
    result = await generate_text_with_fallback_async([{"role": "user", "content": prompt}])
    await sync_to_async(cache.set)(key, result, ttl)
    return result


def get_course_list_cache_key(user_id):
    return f"course_list_{user_id}"


def get_course_detail_cache_key(course_uuid):
    return f"course_detail_{course_uuid}"


def get_lesson_detail_cache_key(lesson_short_id):
    return f"lesson_detail_{lesson_short_id}"


def invalidate_featured_courses_cache():
    from django.core.cache import cache

    try:
        cache.incr("featured_courses_version")
    except (ValueError, TypeError):
        cache.set("featured_courses_version", 1, 86400 * 30)


def invalidate_course_cache(course_uuid, user_id=None):
    from django.core.cache import cache

    cache.delete(get_course_detail_cache_key(course_uuid))
    if user_id:
        cache.delete(get_course_list_cache_key(user_id))
    invalidate_featured_courses_cache()
