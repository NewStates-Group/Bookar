import concurrent.futures
import logging
import shutil
import subprocess
import tempfile
import uuid
import wave
from io import BytesIO
from pathlib import Path

from celery import shared_task
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from google.genai import types
from PIL import Image, ImageDraw

from .exceptions import CourseCreationError, LessonDoesNotExist, ThumbnailCreationError
from .models import Choice, Course, Lesson, Module, Question, Quiz
from .utils import (
    extract_json,
    get_genai_client,
    ollama_chat,
)

logger = logging.getLogger(__name__)


def _save_pcm_as_wav(filename, pcm_bytes, channels=1, rate=24000, sample_width=2):
    try:
        with wave.open(str(filename), "wb") as wf:
            wf.setnchannels(channels)
            wf.setsampwidth(sample_width)
            wf.setframerate(rate)
            wf.writeframes(pcm_bytes)
        return True
    except Exception as e:
        logger.error(f"Failed to save PCM as WAV: {e}")
        return False


def _normalize_audio(input_path, output_path):
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_path),
        "-ac",
        "2",
        "-ar",
        "44100",
        "-c:a",
        "pcm_s16le",
        str(output_path),
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Audio normalization failed for {input_path}: {e.stderr}")
        return False


def _generate_audio(client, text, output_path):
    try:
        response = client.models.generate_content(
            model=settings.AI.get("GENAI_MODEL_AUDIO", "gemini-2.5-flash-preview-tts"),
            contents=text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name="Puck"
                        )
                    )
                ),
            ),
        )

        audio_bytes = None
        if hasattr(response, "parts"):
            for part in response.parts:
                if part.inline_data:
                    return _save_pcm_as_wav(output_path, audio_bytes)
            raise ValueError("No audio data received from API")
    except Exception as e:
        logger.error(f"Audio generation failed: {e}")
        return False


def _create_fallback_image(prompt, output_path):
    try:
        img = Image.new("RGB", (1920, 1080), "white")
        draw = ImageDraw.Draw(img)
        draw.text((100, 500), prompt[:200], fill="black")
        img.save(output_path)
        return True
    except Exception as e:
        logger.error(f"Fallback image generation failed: {e}")
        return False


def _generate_image(client, prompt, output_path, timeout=30):
    try:
        img_prompt = f"Hand-drawn whiteboard animation style, minimalist black marker on white board: {prompt}. Any visible text MUST be in Portuguese."
        response = client.models.generate_content(
            model=settings.AI.get("GENAI_MODEL_IMAGE", "gemini-2.5-flash-image"),
            contents=img_prompt,
            config=types.GenerateContentConfig(
                image_config=types.ImageConfig(aspect_ratio="16:9")
            ),
        )
        for part in response.parts:
            if part.inline_data:
                output_path.write_bytes(part.inline_data.data)
                return True
        raise ValueError("No image data")
    except Exception as e:
        logger.warning(f"Image failed, using fallback: {e}")
        return _create_fallback_image(prompt, output_path)


def _stitch_video(image, audio, output):
    cmd = [
        "ffmpeg",
        "-y",
        "-loop",
        "1",
        "-i",
        str(image),
        "-i",
        str(audio),
        "-c:v",
        "libx264",
        "-tune",
        "stillimage",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-shortest",
        "-c:a",
        "aac",
        str(output),
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=60)
        return True
    except Exception as e:
        logger.error(f"FFmpeg failed: {e}")
        return False


def _process_segment(i, segment, client, temp_dir):
    narration = segment.get("narration")
    visual = segment.get("visual_prompt")

    if not narration:
        return None

    audio = temp_dir / f"s{i}.wav"
    image = temp_dir / f"s{i}.png"
    video = temp_dir / f"s{i}.mp4"

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        audio_future = pool.submit(_generate_audio, client, narration, audio)
        image_future = pool.submit(_generate_image, client, visual, image)

        if not audio_future.result():
            return None
        image_future.result()

    if not _stitch_video(image, audio, video):
        return None
    return video


@shared_task
def generate_lesson(user_id, lesson_id: int):
    lesson = Lesson.objects.filter(id=lesson_id).first()
    if not lesson:
        raise LessonDoesNotExist()

    if Lesson.objects.filter(
        module__course__user_id=user_id, status="PROCESSING"
    ).exists():
        raise RuntimeError("Only one lesson at a time")

    lesson.status = "PROCESSING"
    lesson.save(update_fields=["status"])

    temp_dir = Path(tempfile.mkdtemp())
    client = get_genai_client()
    try:
        plan_prompt = f"""
        Title: {lesson.title}
        Description: {lesson.desc}
        Context: {lesson.narration}
        **USE PORTUGUESE ON THE JSON VALUES**
        **KEYS MUST KEEP THE ORIGINAL ENGLISH NAMES**
        Generate a JSON list of segments:
        [
        {{
            "narration": "...",
            "visual_prompt": "..."
        }}
        ]
        """

        plan_response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=plan_prompt,
            config={"response_mime_type": "application/json"},
        )
        segments = extract_json(plan_response.text) or []
        if not segments:
            raise ValueError("No segments generated")

        videos = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = [
                executor.submit(_process_segment, i, s, client, temp_dir)
                for i, s in enumerate(segments)
            ]
            for f in concurrent.futures.as_completed(futures):
                result = f.result()
                if result:
                    videos.append(result)

        if not videos:
            raise RuntimeError("No video segments created")

        list_file = temp_dir / "list.txt"
        list_file.write_text("\n".join(f"file '{v}'" for v in videos))
        output_dir = Path(settings.MEDIA_ROOT) / "courses/lessons"
        output_dir.mkdir(parents=True, exist_ok=True)
        output = output_dir / f"{uuid.uuid4()}.mp4"

        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(list_file),
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                str(output),
            ],
            check=True,
            timeout=300,
        )

        lesson.lesson_file = f"courses/lessons/{output.name}"
        lesson.status = "READY"
        lesson.save()

        Course.objects.filter(id=lesson.module.course_id, status="PROCESSING").update(
            status="READY"
        )

        return lesson.lesson_file
        return f"Video generated: {lesson.lesson_file}"
    except Exception as e:
        lesson.status = "ERROR"
        lesson.save(update_fields=["status"])
        raise e
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@shared_task
def generate_next_module(user_pk: int, course_pk: int):
    try:
        course = Course.objects.prefetch_related("modules").get(pk=course_pk)
    except Course.DoesNotExist:
        logger.error(f"Course {course_pk} not found for module generation")
        return

    # Build context from existing modules
    existing_modules = course.modules.all().order_by("created_at")
    modules_context = "\n".join([f"- {m.name}: {m.desc}" for m in existing_modules])

    prompt = (
        "You are an expert educational content creator. "
        "Create the NEXT module for this course in JSON format. "
        "Don't enumerate the lesson like this 1.1 -, don't enumerate nothing. "
        "Generate de JSON values in portugues, keep the keys in english. "
        "Strictly follow this JSON schema:"
        "{"
        '  "title": "Título do módulo",'
        '  "desc": "Descrição do módulo",'
        '  "lessons": ['
        "    {"
        '      "title": "Título da lição",'
        '      "desc": "Descrição da lição",'
        '      "duration": 300, '
        '      "narration": "Detailed narration text (600-800 words), engaging and podcast-style...",'
        '      "key_points": "Key takeaway 1, Key takeaway 2",'
        '      "scene_suggestion": "Visual description for whiteboard animation"'
        "    }\n"
        "  ]\n"
        "}\n\n"
        f"Course Title: {course.title}\n"
        f"Course Level: {course.level}\n"
        f"Context (Existing Modules):\n{modules_context}\n\n"
        "Generate ONLY the ONE next module. Ensure flow and continuity."
    )

    try:
        response = ollama_chat([{"role": "user", "content": prompt}])
        module_data = extract_json(response)

        if not module_data:
            raise ValueError("Failed to extract JSON for module")

        module_object = Module.objects.create(
            course=course,
            name=module_data.get("title")[:80],
            desc=module_data.get("desc", ""),
        )

        lessons_data = module_data.get("lessons", [])
        lessons_to_create = []
        for lesson in lessons_data:
            lessons_to_create.append(
                Lesson(
                    module=module_object,
                    title=lesson.get("title", "")[:150],
                    desc=lesson.get("desc", ""),
                    narration=lesson.get("narration", ""),
                    key_points=lesson.get("key_points", "")[:150],
                    scene_suggestion=lesson.get("scene_suggestion", ""),
                    duration=lesson.get("duration", 120),
                    status="PENDING",
                )
            )
        Lesson.objects.bulk_create(lessons_to_create)
        first_lesson = (
            Lesson.objects.filter(module=module_object).order_by("id").first()
        )
        if first_lesson:
            generate_lesson.delay(user_pk, first_lesson.id)

    except Exception as e:
        module_object.delete()
        logger.error(f"Failed to generate next module: {e}")
    finally:
        Course.objects.filter(pk=course_pk).update(status="READY")


@shared_task
def generate_quiz(lesson_id: int):
    try:
        lesson = Lesson.objects.get(pk=lesson_id)
    except Lesson.DoesNotExist:
        return

    prompt = (
        f"Create a multiple choice quiz for the following lesson content.\n"
        f"Title: {lesson.title}\n"
        f"Content: {lesson.narration}\n\n"
        "Output JSON format:\n"
        "{\n"
        '  "title": "Quiz Title",\n'
        '  "description": "Short description",\n'
        '  "questions": [\n'
        "    {\n"
        '      "text": "Question text?",\n'
        '      "explanation": "Why this is correct...",\n'
        '      "choices": [\n'
        '        {"text": "Option A", "is_correct": false},\n'
        '        {"text": "Option B", "is_correct": true}\n'
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Generate 3-5 questions."
    )

    try:
        response = ollama_chat([{"role": "user", "content": prompt}])
        quiz_data = extract_json(response)

        if not quiz_data:
            return

        quiz = Quiz.objects.create(
            lesson=lesson,
            course=lesson.module.course,
            title=quiz_data.get("title", f"Quiz: {lesson.title}"),
            description=quiz_data.get("description", ""),
        )

        for q_data in quiz_data.get("questions", []):
            question = Question.objects.create(
                quiz=quiz,
                text=q_data.get("text", "?"),
                explanation=q_data.get("explanation", ""),
            )
            for c_data in q_data.get("choices", []):
                Choice.objects.create(
                    question=question,
                    text=c_data.get("text", ""),
                    is_correct=c_data.get("is_correct", False),
                )

    except Exception as e:
        logger.error(f"Quiz generation failed: {e}")


@shared_task
def create_course_description(course_pk: int, title: str, details: str, level: str):
    prompt = f"""
    You are an AI that outputs STRICT JSON.

    Rules:
    - Output ONLY valid JSON
    - No comments
    - No markdown
    - No extra text
    - Follow the schema exactly
    - Do not add or remove fields
    - Use double quotes only

    Schema:
    {{
        "desc": string -> create the course description
    }}

    Context:
    Course title: {title}
    Course level: {level}
    User Details: {details}

    Task:
    Generate ONLY the next module.
    """

    course_outline = None
    try:
        response = ollama_chat([{"role": "user", "content": prompt}])
        course_outline = extract_json(response)
    except Exception as e:
        logger.error(f"Outline generation failed: {e}")
        Course.objects.filter(pk=course_pk).update(status="FAILED")
        raise CourseCreationError(f"Erro ao criar estrutura do curso: {str(e)}")

    if isinstance(course_outline, dict):
        course_desc = course_outline.get("desc", f"Curso sobre {title}")
    else:  # fallback
        course_desc = f"Curso sobre {title}"

    Course.objects.filter(pk=course_pk).update(desc=course_desc, status="PROCESSING")
    create_course_thumb.delay(course_pk, title)


@shared_task
def create_course_thumb(course_pk: str, title: str):
    client = get_genai_client()
    prompt = f"""
    Capa profissional de curso educacional.
    Título do curso (em português, bem legível): "{title}"

    Estilo visual:
    - Design moderno, limpo e acadêmico
    - Cores vibrantes e profissionais
    - Gradientes suaves
    - Ilustração ou composição vetorial (não realista)

    Elementos obrigatórios:
    - O título do curso em português, centralizado ou em destaque
    - Ícones, símbolos ou logos que REPRESENTEM o tema do curso
    - Layout equilibrado, sem poluição visual

    Regras:
    - Todo o texto deve estar em português
    - Não adicionar textos extras além do título
    - Não usar marcas d\'água
    - Fundo claro ou gradiente moderno
    """

    try:
        response = client.models.generate_content(
            model=settings.AI.get("GENAI_MODEL_IMAGE", "gemini-2.5-flash-image"),
            contents=[prompt],
            config=types.GenerateContentConfig(
                image_config=types.ImageConfig(aspect_ratio="16:9")
            ),
        )

        image_bytes = None
        for part in response.parts:
            if part.inline_data:
                image_bytes = part.inline_data.data
                break

        image = Image.open(BytesIO(image_bytes)).convert("RGB")

        filename = f"thumbs/{uuid.uuid4()}.jpg"
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=90)
        buffer.seek(0)

        default_storage.save(filename, ContentFile(buffer.read()))
        Course.objects.filter(pk=course_pk).update(thumb=filename)
        course = Course.objects.get(pk=course_pk)
        generate_next_module.delay(course.user.pk, course_pk)
    except Exception as e:
        logger.error(f"Thumbnail creation failed: {e}")
        Course.objects.filter(pk=course_pk).update(status="FAILED")
        raise ThumbnailCreationError(f"Erro ao criar thumbnail: {str(e)}")
