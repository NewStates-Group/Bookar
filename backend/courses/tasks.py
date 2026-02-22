import concurrent.futures
import logging
import shutil
import subprocess
import tempfile
import uuid
import wave
from io import BytesIO
from pathlib import Path
from typing import List, Optional
from celery import shared_task
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from google.genai import types
from PIL import Image, ImageDraw, UnidentifiedImageError

from .exceptions import CourseCreationError, LessonDoesNotExist, ThumbnailCreationError
from .models import Choice, Course, Lesson, Module, Question, Quiz
from .utils import (
    extract_json,
    get_genai_client,
    genai_chat,
)

logger = logging.getLogger(__name__)


def _save_pcm_as_wav(filename, pcm_bytes, channels=1, rate=24000, sample_width=2):
    if pcm_bytes is None:
        logger.error("PCM bytes is None, skipping WAV save")
        return False

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

        if hasattr(response, "parts"):
            for part in response.parts:
                if part.inline_data:
                    return _save_pcm_as_wav(output_path, part.inline_data.data)
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
        subprocess.run(cmd, check=True, capture_output=True, timeout=15 * 60)
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

    if lesson.status == "READY":
        logger.info(f"Lesson {lesson_id} already READY, skipping generation.")
        return lesson.lesson_file

    if Lesson.objects.filter(
        module__course__user_id=user_id, status="PROCESSING"
    ).exclude(id=lesson_id).exists():
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
        A narration deve ser suficiente para cobrir 7 a 12 minutos de aula
        Generate a JSON list of segments:
        [
        {{
            "narration": "...",
            "visual_prompt": "..."
        }}
        ]
        """

        response = genai_chat([{"role": "user", "content": plan_prompt}])
        segments = extract_json(response, isList=True) or []

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

        logo_path = settings.BASE_DIR / "static" / "logo.png"

        list_file = temp_dir / "list.txt"
        list_file.write_text("\n".join(f"file '{v}'" for v in videos))
        output_dir = Path(settings.MEDIA_ROOT) / "courses/lessons"
        output_dir.mkdir(parents=True, exist_ok=True)
        output = output_dir / f"{uuid.uuid4()}.mp4"
        temp_output = output_dir / f"temp_{uuid.uuid4()}.mp4"

        # subprocess.run(
        #     [
        #         "ffmpeg",
        #         "-y",
        #         "-f",
        #         "concat",
        #         "-safe",
        #         "0",
        #         "-i",
        #         str(list_file),
        #         "-c:v",
        #         "libx264",
        #         "-preset",
        #         "veryfast",
        #         "-pix_fmt",
        #         "yuv420p",
        #         "-c:a",
        #         "aac",
        #         str(output),
        #     ],
        #     check=True,
        #     timeout=300,
        # )

        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", str(list_file),
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                str(output),
            ],
            check=True,
            timeout=15*60,
        )

        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i", str(output),
                "-i", str(logo_path),
                "-filter_complex", "[1:v]scale=iw*0.08:-1[logo];[logo]format=rgba[logo];[0:v][logo]overlay=20:20",
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                "-b:a", "128k",
                str(temp_output),
            ],
            check=True,
            timeout=15*60,
        )


        lesson.lesson_file = f"courses/lessons/{temp_output.name}"
        lesson.status = "READY"
        lesson.save()

        return lesson.lesson_file
        return f"Video generated: {lesson.lesson_file}"
    except Exception as e:
        lesson.status = "ERROR"
        lesson.save(update_fields=["status"])
        raise e
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@shared_task
def generate_next_module(user_pk: int, course_pk: int, module_pk: int = None):
    try:
        course = Course.objects.get(pk=course_pk)
    except Course.DoesNotExist:
        logger.error(f"Course {course_pk} not found for module generation")
        return

    existing_modules = course.modules.all().order_by("created_at")
    logger.critical(existing_modules)
    modules_context = "\n".join([f"- {m.name}: {m.desc}" for m in existing_modules])
    # entre 8-15
    prompt = (
        "You are an expert educational content creator. "
        "Create the NEXT module for this course in JSON format. "
        "Don't enumerate the lesson like this 1.1 -, don't enumerate nothing. "
        "Generate the JSON values in portugues, keep the keys in english. "
        "Cada módulo deve ter apenas 2 aulas. "
        "Gera módulos seguindo uma progressão lógica: Comece SEMPRE com História, Definição, Conceitos Teóricos e Contexto. "
        "NÃO comece com prática imediata ou tópicos avançados. "
        "Exemplo: Se for um curso de HTML, 1. História da Web, 2. O que é HTML, 3. Estrutura Básica, e então Prática. "
        "Mantenha essa estrutura progressiva para todo o curso. "
        "Cada aula deve ter conteúdo para 5 a 12 minutos"
        "Strictly follow this JSON schema:"
        "{"
        '  "title": "Título do módulo (sem enumeração, Módulo 1:, directo o título do módulo)",'
        '  "desc": "Descrição do módulo",'
        '  "lessons": ['
        "    {"
        '      "title": "Título da lição",'
        '      "desc": "Descrição da lição",'
        '      "duration": 300, '
        '      "narration": "Detailed narration text, engaging and podcast-style...",'
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
    module_object = None
    try:
        response = genai_chat([{"role": "user", "content": prompt}])
        module_data = extract_json(response)

        if not module_data:
            raise ValueError("Failed to extract JSON for module")

        if module_pk:
            module_object = Module.objects.get(pk=module_pk)
            module_object.name = module_data.get("title")[:80]
            module_object.desc = module_data.get("desc", "")
            module_object.status = "READY"
            module_object.save()
        else:
            module_object = Module.objects.create(
                course=course,
                name=module_data.get("title")[:80],
                desc=module_data.get("desc", ""),
                status="READY"
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
        
        # Only auto-generate the first lesson if this is the very first module of the course
        if course.modules.count() == 1:
            first_lesson = (
                Lesson.objects.filter(module=module_object).order_by("id").first()
            )
            if first_lesson:
                generate_lesson.delay(user_pk, first_lesson.id)
            
            # For the first module, mark course as READY to show in dashboard
            Course.objects.filter(pk=course_pk).update(status="READY")
                
        # Generate module quiz
        generate_module_quiz.delay(module_object.id)

    except Exception as e:
        if module_pk:
            Module.objects.filter(pk=module_pk).update(status="FAILED")
        elif module_object:
            module_object.delete()
        logger.error(f"Failed to generate next module: {e}")
        # Only set course to READY if it was processing the very first module
        if course.modules.count() <= 1:
            Course.objects.filter(pk=course_pk).update(status="READY")


@shared_task
def generate_module_quiz(module_id: int):
    module_object = Module.objects.filter(pk=module_id).first()
    if not module_object:
        logger.error(f"Module {module_id} not found")
        return

    try:
        # Aggregate content from all lessons in the module
        lessons_content = []
        for lesson in module_object.lessons.all():
            lessons_content.append(f"Lesson: {lesson.title}\nContent: {lesson.key_points}\n")
        
        full_text = "\n".join(lessons_content)

        prompt = f"""
        Baseado no conteúdo abaixo, crie um quiz com 3 perguntas de múltipla escolha para testar o conhecimento do aluno sobre este módulo.
        
        Conteúdo do Módulo:
        {full_text}

        Retorne APENAS um JSON válido com a seguinte estrutura:
        {{
            "title": "Título do Quiz",
            "questions": [
                {{
                    "text": "Pergunta 1",
                    "explanation": "Explicação da resposta correta",
                    "choices": [
                        {{"text": "Opção A", "is_correct": false}},
                        {{"text": "Opção B", "is_correct": true}},
                        {{"text": "Opção C", "is_correct": false}}
                    ]
                }}
            ]
        }}
        """

        response = genai_chat(prompt)
        quiz_data = extract_json(response)

        if not quiz_data:
            logger.error("Failed to parse quiz JSON")
            return

        # Create Quiz linked to Module
        quiz = Quiz.objects.create(
            module=module_object,
            course=module_object.course,
            title=quiz_data.get("title", f"{module_object.name}"),
        )

        for q in quiz_data.get("questions", []):
            question = Question.objects.create(
                quiz=quiz,
                text=q.get("text"),
                explanation=q.get("explanation", ""),
            )
            for c in q.get("choices", []):
                Choice.objects.create(
                    question=question,
                    text=c.get("text"),
                    is_correct=c.get("is_correct", False),
                )
        
        logger.info(f"Quiz generated for module {module_id}")

    except Exception as e:
        logger.error(f"Module quiz generation failed: {e}") 



@shared_task
def create_course_details(course_pk: int, prompt: str, level: str):
    ai_prompt = f"""
    You are an AI that outputs STRICT JSON.

    Rules:
    - Output ONLY valid JSON
    - No comments
    - No markdown
    - No extra text
    - Follow the schema exactly
    - Do not add or remove fields
    - Use double quotes only
    - **GENERATE ALL THE VALUES IN PORTUGUESE;THE KEYS REMAIN IN ENGLISH**

    Schema:
    {{
        "title": string, 
        "desc": string,
        "max_modules": integer (between 3 and 5)
    }}

    Context:
    Course prompt: {prompt}
    Course level: {level}

    Task:
    Generate a title, description, and an estimated number of modules (max_modules) to cover this topic comprehensively.
    """

    course_outline = None
    try:
        response = genai_chat([{"role": "user", "content": ai_prompt}])
        course_outline = extract_json(response)
    except Exception as e:
        logger.error(f"Outline generation failed: {e}")
        Course.objects.filter(pk=course_pk).update(status="FAILED")
        return
    
    course_title = course_outline.get("title", "Sem título")
    course_desc = course_outline.get("desc", course_title)
    max_modules = course_outline.get("max_modules", 5)

    # Validate max_modules range
    if not isinstance(max_modules, int) or max_modules < 3:
        max_modules = 3
    if max_modules > 5:
        max_modules = 5

    Course.objects.filter(pk=course_pk).update(
        desc=course_desc, title=course_title, max_modules=max_modules, status="PROCESSING"
    )
    create_course_thumb.delay(course_pk, prompt)


@shared_task
def create_course_thumb(course_pk: str, prompt: str):
    client = get_genai_client()
    ai_prompt = f"""
    Cria uma capa profissional de curso educacional.
    Tema do curso: "{prompt}"

    Estilo visual:
    - Design moderno e limpo
    - Cores adequadas ao tema
    - Gradientes suaves se necessário
    - Logos ou ilustrações no centro (não realistas)
    - Faz uma thumb retângular, não quadrada

    Regras:
    - Todo o texto deve estar em português
    - Não adicionar textos desnecessários, é apenas uma capa
    - Não usar marcas d\'água
    - Não coloca nenhum texto ou figura nos cantos
    - Não coloca elementos aleatórios tipo logos que não estão relacionadas com o curso pedido
    """

    try:
        response = client.models.generate_content(
            model=settings.AI.get("GENAI_MODEL_IMAGE", "gemini-2.5-flash-image"),
            contents=[ai_prompt],
            config=types.GenerateContentConfig(
                image_config=types.ImageConfig(aspect_ratio="16:9")
            ),
        )

        image_part = next(
            (
                part.inline_data
                for part in response.parts
                if part.inline_data is not None
            ),
            None,
        )

        if not image_part or not image_part.mime_type.startswith("image/"):  # NOQA
            raise ThumbnailCreationError("IA não retornou uma imagem válida")

        try:
            bytes_data = BytesIO(image_part.data)  # NOQA
            image = Image.open(bytes_data)
            image.verify()
            image = Image.open(bytes_data).convert("RGBA")
        except UnidentifiedImageError:
            raise ThumbnailCreationError("Conteúdo retornado não é uma imagem")

        logo_path = settings.BASE_DIR / "static" / "logo.png"
        logo = Image.open(logo_path).convert("RGBA")
        img_width, img_height = image.size
        logo_width = int(img_width * 0.08)
        logo_ratio = logo_width / logo.width
        logo_height = int(logo.height * logo_ratio)

        logo = logo.resize((logo_width, logo_height), Image.Resampling.LANCZOS)

        margin = int(img_width * 0.03)
        position = (margin, margin)

        image.paste(logo, position, logo)
        image = image.convert("RGB")

        buffer = BytesIO()
        filename = f"thumbs/{uuid.uuid4()}.jpg"
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
