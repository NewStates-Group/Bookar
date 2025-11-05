import json

from django.conf import settings
from ninja import Router, Schema
from ollama import Client

from .models import LevelChoices, Tag

router = Router()
client = Client(
    host="https://ollama.com",
    headers={
        "Authorization": "Bearer edeb6900fdab480fa5038618260f04d7.gIzDAUDp-Vx90Te-H4aGpT9j"
    },
)


class CourseCreateSchema(Schema):
    title: str
    desc: str
    level: LevelChoices


class TagSchema(Schema):
    name: str


class CoursePlanSchema(Schema):
    title: str
    outline: dict


@router.post("/", response=CoursePlanSchema)
async def create_course(request, data: CourseCreateSchema):
    messages = [
        {
            "role": "system",
            "content": (
                "Você é um criador de roteiros educacionais multimídia. "
                "Gere um plano de curso JSON seguindo a estrutura: "
                "{title:str, desc:str, level:str, modules:list[dict]}. "
                "Cada módulo deve conter: {title:str, desc:str, lessons:list[dict]}, "
                "e cada aula deve conter {title:str, desc:str, narration:str, key_points:list[str], scene_suggestion:str}. "
                "A narração deve ser natural, como um professor explicando em vídeo. "
                "scene_suggestion deve descrever o cenário visual da aula (ex: 'professor em frente a quadro digital'). "
                "Gere JSON limpo, válido e completo, pronto para salvar no banco e gerar vídeo e áudio automaticamente."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Crie um roteiro completo para o curso '{data.title}'. "
                f"Descrição: {data.desc}. "
                f"O nível do curso deve ser: {data.level}. "
                "Inclua pelo menos 3 módulos, cada módulo com pelo menos 2 a 5 aulas. "
                "Cada aula deve conter 'narration' e 'scene_suggestion' para vídeos."
            ),
        },
    ]
    response_text = ""
    for part in client.chat(
        settings.AI["MODEL"],
        messages=messages,
        stream=True,
    ):
        if "content" in part["message"]:
            content = part["message"]["content"]
            response_text += content
    try:
        course_outline = json.loads(response_text)
    except json.JSONDecodeError:
        cleaned = response_text.strip().split("{", 1)[-1]
        cleaned = "{" + cleaned.rsplit("}", 1)[0] + "}"
        course_outline = json.loads(cleaned)

    return {
        "title": data.title,
        "outline": course_outline,
    }


@router.get("/tags/", response=list[TagSchema])
def get_tags(request):
    return Tag.objects.all()


@router.post("/tags/create", response=TagSchema)
async def create_tag(request, data: TagSchema):
    return await Tag.objects.acreate(name=data.name)
