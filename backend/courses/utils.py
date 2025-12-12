from time import time
import orjson
from django.core.exceptions import ObjectDoesNotExist
from django.utils.text import slugify
from ninja.errors import HttpError

from .models import Tag


def extract_json(response: str):
    cleaned = response.strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")

    if start < 0 or end < 0 or start > end:
        raise ValueError("Nenhum JSON válido encontrado")
        
    cleaned = cleaned[start : end + 1]
    
    try:
        return orjson.loads(cleaned)
    except orjson.JSONDecodeError:
        raise ValueError("Falha ao converter string")


def get_tag(id):
    try:
        return Tag.objects.get(id=id)
    except ObjectDoesNotExist:
        raise HttpError(404, "Tag não encontrada.")


def time_based_name(name: str) -> str:
    return slugify(f"{name}-{int(time())}")
