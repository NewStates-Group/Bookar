import concurrent.futures
import logging
import shutil
import subprocess
import tempfile
import uuid
import wave
from io import BytesIO
from pathlib import Path

import orjson
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
    get_next_lesson,
    get_ollama_client,
    ollama_chat,
)

logger = logging.getLogger(__name__)


def _save_pcm_as_wav(filename, pcm_bytes, channels=1, rate=24000, sample_width=2):
    """
    Writes raw PCM bytes to a valid WAV file using python's wave module.
    Default parameters match Gemini TTS output: 24kHz, 16-bit (width=2), Mono.
    """
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
    """
    Resamples input audio to standardized 44.1kHz Stereo WAV.
    Input is assumed to be a valid WAV file from _save_pcm_as_wav.
    """
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
    """
    Generates audio using Gemini TTS and saves it as a valid WAV file.
    """
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
                    audio_bytes = part.inline_data.data
                    break

        if not audio_bytes and hasattr(response, "candidates") and response.candidates:
            for part in response.candidates[0].content.parts:
                if part.inline_data:
                    audio_bytes = part.inline_data.data
                    break

        if not audio_bytes:
            raise ValueError("No audio data received from API")

        return _save_pcm_as_wav(output_path, audio_bytes)

    except Exception as e:
        logger.error(f"Audio generation failed: {e}")
        return False


def _create_fallback_image(prompt, output_path):
    """
    Creates a simple text-based fallback image.
    """
    try:
        img = Image.new("RGB", (1920, 1080), color="white")
        draw = ImageDraw.Draw(img)
        text_preview = prompt[:200] + "..." if len(prompt) > 200 else prompt
        draw.text((100, 500), f"Visual Concept:\n{text_preview}", fill="black")
        img.save(output_path)
        logger.warning(f"Generated fallback image for: {output_path}")
        return True
    except Exception as e:
        logger.error(f"Fallback image generation failed: {e}")
        return False


def _generate_image(client, prompt, output_path, timeout=30):
    """
    Generates an image with a strict timeout using ThreadPoolExecutor.
    """

    def _call_api():
        img_prompt = f"Hand-drawn whiteboard animation style, minimalist black marker on white board: {prompt}. Any visible text MUST be in Portuguese."
        return client.models.generate_content(
            model=settings.AI.get("GENAI_MODEL_IMAGE", "gemini-2.5-flash-image"),
            contents=img_prompt,
            config=types.GenerateContentConfig(
                image_config=types.ImageConfig(aspect_ratio="16:9")
            ),
        )

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_call_api)
            try:
                response = future.result(timeout=timeout)
            except concurrent.futures.TimeoutError:
                logger.error("Image generation timed out.")
                raise TimeoutError("Image generation timed out")

        img_data = None
        if hasattr(response, "parts"):
            for part in response.parts:
                if part.inline_data:
                    img_data = part.inline_data.data
                    break
        elif hasattr(response, "generated_images"):
            img_data = response.generated_images[0].image.image_bytes

        if not img_data:
            raise ValueError("No image data received from API")

        with open(output_path, "wb") as f:
            f.write(img_data)

        try:
            with Image.open(output_path) as img:
                img.verify()
        except Exception as e:
            logger.error(f"Generated image is invalid/corrupt: {e}")
            if output_path.exists():
                output_path.unlink()
            raise ValueError("Invalid image generated")

        return True

    except Exception as e:
        logger.error(f"Image generation failed: {e}")
        return False


def _stitch_video(image_path, audio_path, output_path):
    """
    Combines image and audio into a video segment using ffmpeg.
    """
    cmd = [
        "ffmpeg",
        "-y",
        "-loop",
        "1",
        "-i",
        str(image_path),
        "-i",
        str(audio_path),
        "-c:v",
        "libx264",
        "-tune",
        "stillimage",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-pix_fmt",
        "yuv420p",
        "-shortest",
        "-vf",
        "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1:color=white",
        str(output_path),
    ]

    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=60)
        return True
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg stitch timed out after 60s")
        return False
    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg failed for segment {output_path.name}")
        logger.error(f"Stderr: {e.stderr}")
        return False


@shared_task
def generate_lesson(user_id, lesson_id: int):
    if Lesson.objects.filter(module__course__user_id=user_id, status="PROCESSING"):
        raise RuntimeError("Can only generator one lesson per time")

    try:
        lesson = Lesson.objects.get(id=lesson_id)

        if lesson.status == "PROCESSING":
            raise RuntimeError("It's already under generation")
    except Lesson.DoesNotExist:
        raise LessonDoesNotExist(f"Lesson {lesson_id} does not exist.")
    Lesson.objects.filter(pk=lesson_id).update(status="PROCESSING")

    temp_dir = Path(tempfile.mkdtemp())
    try:
        client = get_genai_client()

        base_context = f"Title: {lesson.title}\nDescription: {lesson.desc}"
        if lesson.narration:
            base_context += f"\nBase Context/Narration: {lesson.narration}"

        plan_prompt = (
            f"{base_context}\n\n"
            "Create a structured Video Lesson Plan as a JSON LIST of segments. "
            "Target total duration: 2, 3 or 5 minute at the maximun. "
            "Each segment represents 20-40 seconds of content. "
            "LANGUAGE PROTOCOL:\n"
            "1. Analyze the language of the Title and Description.\n"
            "2. Generate the 'narration' in that SAME language.\n"
            "3. If the language is unclear or not specified, STRICTLY USE PORTUGUESE (pt-PT).\n\n"
            "Format: \n"
            "[\n"
            "  {\n"
            '    "narration": "Text for the narrator to speak (approx 3-5 sentences)...",\n'
            '    "visual_prompt": "Detailed description for a Hand-drawn Whiteboard Style image..."\n'
            "  }\n"
            "]\n"
            "Ensure the visual prompts result in simple, clear, educational sketches on a white background."
        )

        segments = []
        try:
            plan_response = client.models.generate_content(
                model="gemini-2.0-flash-exp",
                contents=plan_prompt,
                config={"response_mime_type": "application/json"},
            )

            try:
                segments_json = orjson.loads(plan_response.text)
            except orjson.JSONDecodeError:
                # Tentar extrair JSON da resposta textual
                segments_json = extract_json(plan_response.text)

            if segments_json is None:
                raise ValueError("Não foi possível extrair JSON da resposta")

            if isinstance(segments_json, dict):
                segments = segments_json.get("segments", [])
                if not segments:
                    # Tentar encontrar qualquer lista no dicionário
                    for value in segments_json.values():
                        if isinstance(value, list):
                            segments = value
                            break
            elif isinstance(segments_json, list):
                segments = segments_json
            else:
                raise ValueError("Formato JSON inválido: não é lista nem dicionário")

            if not isinstance(segments, list) or len(segments) == 0:
                raise ValueError("JSON válido não contém lista de segmentos")

        except Exception as e:
            logger.error(f"Failed to plan segments: {e}. Using fallback.")
            segments = [
                {
                    "narration": lesson.narration
                    if lesson.narration
                    else f"Welcome to {lesson.title}.",
                    "visual_prompt": f"Title card for {lesson.title}",
                }
            ]

        logger.info(f"Generated {len(segments)} segments.")

        segment_videos = []

        for i, segment in enumerate(segments):
            logger.info(f"Processing segment {i + 1}/{len(segments)}...")

            narration_text = segment.get("narration", "")
            visual_prompt = segment.get("visual_prompt", "")

            if not narration_text:
                continue

            raw_audio_path = temp_dir / f"seg_{i}_raw_audio.wav"
            if not _generate_audio(client, narration_text, raw_audio_path):
                logger.warning(f"Skipping segment {i} due to audio failure")
                continue

            audio_path = temp_dir / f"seg_{i}_audio.wav"
            if not _normalize_audio(raw_audio_path, audio_path):
                logger.warning(
                    f"Skipping segment {i} due to audio normalization failure"
                )
                continue

            image_path = temp_dir / f"seg_{i}_img.png"
            success = _generate_image(client, visual_prompt, image_path, timeout=40)

            if not success:
                logger.info(f"Using fallback image for segment {i}")
                if not _create_fallback_image(visual_prompt, image_path):
                    logger.warning(f"Skipping segment {i} due to total image failure")
                    continue

            video_path = temp_dir / f"seg_{i}_video.mp4"
            if _stitch_video(image_path, audio_path, video_path):
                segment_videos.append(video_path)
            else:
                logger.warning(f"Skipping segment {i} due to ffmpeg failure")

        if not segment_videos:
            raise Exception("No video segments were successfully generated.")

        logger.info("Concatenating segments...")

        list_file = temp_dir / "segments_list.txt"
        with open(list_file, "w") as f:
            for v_path in segment_videos:
                f.write(f"file '{v_path.absolute()}'\n")

        output_dir = Path(settings.MEDIA_ROOT) / "courses" / "lessons"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_filename = f"{uuid.uuid4()}.mp4"
        output_path = output_dir / output_filename

        cmd_concat = [
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
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "23",
            "-preset",
            "veryfast",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(output_path),
        ]

        try:
            subprocess.run(cmd_concat, check=True, capture_output=True, timeout=300)
            logger.info(f"Video generated at {output_path}")
            lesson.lesson_file = f"courses/lessons/{output_filename}"
            lesson.status = "READY"
            lesson.save()

            course = lesson.module.course
            if course.status == "PROCESSING":
                Course.objects.filter(pk=course.pk).update(status="READY")

        except subprocess.TimeoutExpired:
            logger.error("Final concatenation timed out")
            raise
        except subprocess.CalledProcessError as e:
            logger.error(f"Final concat failed: {e.stderr}")
            raise

        # generate_quiz.delay(lesson.id)

        return f"Video generated: {lesson.lesson_file}"

    except Exception as e:
        logger.critical(f"Error during lesson generation task: {str(e)}")

        try:
            lesson_obj = Lesson.objects.get(id=lesson_id)
            lesson_obj.status = "ERROR"
            lesson_obj.save()
        except Exception as save_error:
            logger.error(f"Failed to update lesson status to ERROR: {save_error}")

        # Re-raise para que o Celery saiba que falhou
        raise Exception(f"Lesson generation failed: {str(e)}")
    finally:
        try:
            shutil.rmtree(temp_dir)
        except Exception as e:
            logger.warning(f"Failed to cleanup temp dir: {e}")


@shared_task
def generate_next_module(user_pk:int, course_pk: int):
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
