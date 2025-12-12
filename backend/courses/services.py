from django.conf import settings
from django.core.cache import cache
from django.db.models.query import QuerySet
from gradio_client import Client as GradioClient
from ninja.errors import HttpError
from ollama import Client as OllamaClient

from .models import Course, Lesson, LevelChoices, Module, Tag
from .tasks import generate_lesson
from .utils import extract_json

ollama_client = OllamaClient(
    host="https://ollama.com",
    headers={"Authorization": f"Bearer {settings.AI['KEY']}"},
)


class TagService:
    def get_tags() -> QuerySet[Tag]:
        return Tag.objects.all()

    def create_tag(name) -> Tag:
        return Tag.objects.create(name=name)


class CourseService:
    def create_course(
        self, title: str, desc: str, level: LevelChoices, tag: Tag
    ) -> Course:
        if not title or not desc or not level:
            raise HttpError(400, "Informe todos os campos obrigatórios")

        # remove caching in production
        # use a text controler to cache the course outline
        course_outline = cache.get_or_set(
            "course_outline",
            lambda: self._create_outline(title, desc, level, tag.name),
            3600,
        )

        if not course_outline:
            raise HttpError(500, "Erro ao criar a estrutura curso")

        # remove caching in production
        # use a title controller to cache the course thumn
        # no verification needed, use other endpoint to create it again
        thumb = cache.get_or_set(
            "course_thumb", lambda: self._create_thumb(title, desc, level), 3600
        )

        course = Course.objects.create(title=title, desc=desc, tag=tag, thumb=thumb)
        try:
            for module in course_outline["modules"]:
                module_object = Module.objects.create(
                    course=course, name=module["title"], desc=module["desc"]
                )
                Lesson.objects.bulk_create(
                    [
                        Lesson(
                            module=module_object,
                            title=lesson["title"],
                            desc=lesson["desc"],
                            narration=lesson["narration"],
                            key_points=lesson["key_points"],
                            scene_suggestion=lesson["scene_suggestion"],
                            duration=lesson["duration"],
                        )
                        for lesson in module["lessons"]  # NOQA
                    ]
                )
        except KeyError:
            # delete to avoid bad formed courses on db
            course.delete()
            raise HttpError(500, "Erro ao salvar dados do curso")
        generate_lesson.delay(self._get_next_lesson(course.pk))
        return course

    def _create_outline(self, title: str, desc: str, level: LevelChoices, tag: str):
        messages = [
            {
                "role": "system",
                "content": (
                    "Você é um criador de roteiros educacionais multimídia. "
                    "Gere um plano de curso JSON seguindo a estrutura: "
                    "{title:str, desc:str, level:str, modules:list[dict]}. "
                    "Cada módulo deve conter: {title:str, desc:str, lessons:list[dict]}, "
                    'e cada aula deve conter {title:str, desc:str, duration: int, narration:str, key_points: str (ex.: "i1","i2"), '
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Crie um roteiro completo para o curso '{title}'. "
                    f"Descrição: {desc}. "
                    f"O nível do curso deve ser: {level}. "
                    f"A tag do curso é {tag}. "
                    "Inclua pelo menos 3 módulos, cada módulo com pelo menos 2 a 5 aulas. "
                    "Cada aula deve conter 'narration' e 'scene_suggestion' para vídeos."
                ),
            },
        ]
        response_text = ollama_client.chat(settings.AI["MODEL"], messages=messages)
        try:
            return extract_json(response_text["message"]["content"])
        except ValueError:
            raise HttpError(500, "Erro ao criar estrutura do curso. Tente novamente.")

    def _create_thumb(self, title: str, desc: str, level: LevelChoices):
        client = GradioClient(
            "stabilityai/stable-diffusion-3.5-large",
            hf_token="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",
            download_files=settings.MEDIA_ROOT / "courses" / "thumbs",
        )

        prompt = (
            f"Professional educational course thumbnail for '{title}'. "
            f"Description: {desc}. Level: {level}. "
            "Use a modern, clean, academic design with bright colors and subtle gradients."
        )

        result = client.predict(
            prompt=prompt,
            negative_prompt="blurry, distorted, low quality, watermark",
            seed=0,
            randomize_seed=True,
            width=1280,
            height=720,
            guidance_scale=5.0,
            num_inference_steps=30,
            api_name="/infer",
        )
        return result[0]
    
    def _get_next_lesson(self, course_id: int) -> Lesson:
        lesson = (
            Lesson.objects.filter(module__course_id=course_id, watched=False)
            .order_by("id")
            .first()
        )

        if not lesson:
            raise HttpError(400, "Não há mais lições no curso")
        return lesson

    def get_lesson(self, course_id: int) -> Lesson:
        lesson = self._get_next_lesson(course_id)
        generate_lesson.delay(self._get_next_lesson(course_id))
        return lesson
