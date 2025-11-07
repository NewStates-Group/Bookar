import json
from time import perf_counter

from django.core.cache import cache
from django.core.exceptions import ObjectDoesNotExist
from django.core.files.base import ContentFile
from django.http import StreamingHttpResponse
from ninja import Router
from ninja.errors import HttpError

from .models import Course, Lesson, Module, Tag
from .schemas import CourseCreateSchema, CoursePlanSchema, TagSchema
from .services import (
    generate_course_lesson,
    generate_course_outline,
    generate_course_thumb,
)

router = Router()


def send_event(message: str, p: int = 0):
    """Helper para gerar eventos SSE"""
    data = {"message": message}
    if p:
        data["p"] = p  # type: ignore
    print(message)
    return f"data: {json.dumps(data)}\n\n"


def get_tag(id):
    try:
        return Tag.objects.get(id=id)
    except ObjectDoesNotExist:
        raise HttpError(404, "Tag não encontrada.")


@router.post("/", response=CoursePlanSchema)
def create_course(request, data: CourseCreateSchema):
    def course_creation_process():
        start = perf_counter()
        tag = get_tag(data.tag)

        yield send_event("Generating course outline...")
        course_outline = cache.get_or_set(
            "course_outline", lambda: generate_course_outline(data), 3600
        )
        course = Course.objects.create(
            title=data.title,
            desc=data.desc,
            tag=tag,
        )
        yield send_event("Generating course thumb...")
        thumb = cache.get_or_set(
            "course_thumb", lambda: generate_course_thumb(data), 3600
        )
        course.thumb = thumb
        yield send_event("Generating course classes...")
        order = 0
        for module in course_outline["modules"]:
            yield send_event(f"Generating {module['title']}...")
            db_module = Module.objects.create(
                name=module["title"], desc=module["desc"], order=order
            )
            for lesson in module["lessons"]:
                yield send_event(f"Generating {lesson['title']}...")
                print(f"Generating {lesson['title']}...")
                db_lesson = Lesson(
                    title=lesson["title"],
                    desc=lesson["desc"],
                    narration=lesson["narration"],
                    key_points=lesson["key_points"],
                    scene_suggestion=lesson["scene_suggestion"],
                    duration_seconds=lesson["duration_seconds"],
                    video_file=generate_course_lesson(lesson),
                )
                db_lesson.save()
                db_module.lessons.add(db_lesson)
            db_module.save()
            course.modules.add(db_module)
            order += 1
        yield send_event("Course generated")
        print(perf_counter() - start)

    return StreamingHttpResponse(
        course_creation_process(), content_type="text/event-stream"
    )


@router.get("/tags/", response=list[TagSchema])
def get_tags(request):
    return Tag.objects.all()


@router.post("/tags/create", response=TagSchema)
async def create_tag(request, data: TagSchema):
    return await Tag.objects.acreate(name=data.name)
