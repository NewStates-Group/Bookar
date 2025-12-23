import orjson
from django.conf import settings
from google import genai
from ollama import Client as OllamaClient

from .models import Lesson


def extract_json(response: str):
    """
    Extracts JSON from a string, handling Markdown code blocks and common formatting issues.
    """
    cleaned = response.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json")[1].split("```")[0]
    elif "```" in cleaned:
        cleaned = cleaned.split("```")[1].split("```")[0]

    cleaned = cleaned.strip()

    start_brace = cleaned.find("{")
    start_bracket = cleaned.find("[")

    if start_brace == -1 and start_bracket == -1:
        raise ValueError("No JSON object or array found in response")

    if start_brace != -1 and (start_bracket == -1 or start_brace < start_bracket):
        start = start_brace
        end = cleaned.rfind("}")
    else:
        start = start_bracket
        end = cleaned.rfind("]")

    if end == -1:
        print(f"FAILED JSON EXTRACTION. Raw: {cleaned[:500]}...")
        raise ValueError("Unclosed JSON structure")

    json_str = cleaned[start : end + 1]

    try:
        return orjson.loads(json_str)
    except orjson.JSONDecodeError as e:
        print(f"JSON DECODE ERROR: {e}. Attempting AI repair...")
        try:
            client = get_genai_client()
            repair_prompt = (
                "Fix the following malformed JSON. Return ONLY the valid JSON, no markdown.\n\n"
                f"{json_str}"
            )
            response = client.models.generate_content(
                model="gemini-2.0-flash-exp",
                contents=repair_prompt,
                config=genai.types.GenerateContentConfig(
                    response_mime_type="application/json"
                ),
            )
            repaired_json = response.text.strip()
            if "```json" in repaired_json:
                repaired_json = (
                    repaired_json.split("```json")[1].split("```")[0].strip()
                )
            elif "```" in repaired_json:
                repaired_json = repaired_json.split("```")[1].split("```")[0].strip()

            return orjson.loads(repaired_json)
        except Exception as repair_error:
            print(f"AI REPAIR FAILED: {repair_error}")
            import json

            return json.loads(json_str)


def get_ollama_client():
    return OllamaClient(
        host="https://ollama.com",
        headers={"Authorization": "Bearer " + settings.AI["OLLAMA_KEY"]},
    )


def get_genai_client():
    return genai.Client(api_key=settings.AI["GENAI_KEY"])


def get_next_lesson(course_pk: int) -> Lesson | None:
    return (
        Lesson.objects.filter(module__course_id=course_pk, watched=False)
        .values_list("id", flat=True)
        .order_by("id")
        .first()
    )
