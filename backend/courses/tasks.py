import concurrent.futures
import json
import logging
import shutil
import subprocess
import tempfile
import uuid
import wave
from pathlib import Path

from celery import shared_task
from django.conf import settings
from google.genai import types
from PIL import Image, ImageDraw

from .exceptions import CourseCreationError, LessonDoesNotExist, ThumbnailCreationError
from .models import Course, Lesson, Module
from .utils import extract_json, get_genai_client, get_next_lesson, get_ollama_client

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
def generate_lesson(lesson_id: int):
    try:
        lesson = Lesson.objects.get(id=lesson_id)
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
                segments_json = json.loads(plan_response.text)
            except json.JSONDecodeError:
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
                course.status = "READY"
                course.save()
        except subprocess.TimeoutExpired:
            logger.error("Final concatenation timed out")
            raise
        except subprocess.CalledProcessError as e:
            logger.error(f"Final concat failed: {e.stderr}")
            raise

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
def create_course_outline(course_pk: int, title: str, details: str, level: str):
    prompt = (
        "You are an expert educational content creator. "
        "Create a detailed multimedia course outline in JSON format. "
        "Strictly follow this JSON schema:"
        "{"
        '  "desc": "Course Description",'
        '  "modules": ['
        "    {"
        '      "title": "Module Title",'
        '      "desc": "Module Description",'
        '      "lessons": ['
        "        {"
        '          "title": "Lesson Title",'
        '          "desc": "Lesson Description",'
        '          "duration": 300, '
        '          "narration": "Detailed narration text (600-800 words), engaging and podcast-style...",'
        '          "key_points": "Key takeaway 1, Key takeaway 2",'
        '          "scene_suggestion": "Visual description for whiteboard animation (e.g. Hand drawing a graph...)"'
        "        }\n"
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n\n"
        f"Generate a course outline based for this prompt: '{details}'.\n"
        f"Title: {title}, level: {level}"
        "Ensure the content is high quality, educational, and ready for video production."
    )

    course_outline = None
    client = get_ollama_client()
    try:
        response = client.chat(
            settings.AI["OLLAMA_MODEL_TEXT"], [{"role": "user", "content": prompt}]
        )
        course_outline_content = response["message"]["content"]
        logger.info(f"Raw outline response: {course_outline_content[:500]}...")

        # Tentar extrair JSON da resposta
        try:
            course_outline = json.loads(course_outline_content)
        except json.JSONDecodeError:
            course_outline = extract_json(course_outline_content)

        if course_outline is None:
            raise ValueError("Não foi possível extrair JSON da resposta da IA")

    except Exception as e:
        logger.error(f"Outline generation failed: {e}")
        # Atualizar status do curso para ERROR
        Course.objects.filter(pk=course_pk).update(status="ERROR", failed=True)
        raise CourseCreationError(f"Erro ao criar estrutura do curso: {str(e)}")

    try:
        # Atualizar descrição do curso
        if isinstance(course_outline, dict):
            course_desc = course_outline.get("desc", f"Curso sobre {title}")
        else:
            course_desc = f"Curso sobre {title}"

        Course.objects.filter(pk=course_pk).update(
            desc=course_desc, status="PROCESSING"
        )

        # Extrair módulos do JSON
        modules_data = []
        if isinstance(course_outline, dict):
            modules_data = course_outline.get("modules", [])
        elif isinstance(course_outline, list):
            if len(course_outline) > 0 and isinstance(course_outline[0], dict):
                modules_data = course_outline[0].get("modules", [])
            else:
                modules_data = course_outline

        if not isinstance(modules_data, list) or len(modules_data) == 0:
            raise ValueError("Nenhum módulo encontrado no JSON")

        # Criar módulos e lições
        for module in modules_data:
            module_object = Module.objects.create(
                course_id=course_pk,
                name=module.get(
                    "title",
                    f"Módulo {Module.objects.filter(course_id=course_pk).count() + 1}",
                ),
                desc=module.get("desc", ""),
            )

            lessons_data = module.get("lessons", [])
            if lessons_data:
                lessons_to_create = []
                for lesson in lessons_data:
                    lessons_to_create.append(
                        Lesson(
                            module=module_object,
                            title=lesson.get(
                                "title", f"Lição {len(lessons_to_create) + 1}"
                            ),
                            desc=lesson.get("desc", ""),
                            narration=lesson.get("narration", ""),
                            key_points=lesson.get("key_points", ""),
                            scene_suggestion=lesson.get("scene_suggestion", ""),
                            duration=lesson.get("duration", 300),
                            status="PENDING",
                        )
                    )
                Lesson.objects.bulk_create(lessons_to_create)

    except Exception as e:
        Course.objects.filter(pk=course_pk).update(status="ERROR", failed=True)
        logger.error(f"Erro ao salvar dados do curso: {e}")
        raise CourseCreationError(f"Erro ao salvar dados do curso: {str(e)}")

    # Iniciar geração da primeira lição
    next_lesson = get_next_lesson(course_pk)
    if next_lesson:
        generate_lesson.delay(next_lesson.id)
    else:
        # Se não houver lições, marcar curso como READY
        Course.objects.filter(pk=course_pk).update(status="READY")


@shared_task
def create_course_thumb(course_pk: str, title: str):
    client = get_genai_client()
    prompt = (
        f"Professional educational course thumbnail for this title: {title}. "
        "Use a modern, clean, academic design with bright colors and subtle gradients. "
        "Ensure the Course Title is visible and written in Portuguese. Any other text must also be in Portuguese."
    )

    try:
        response = client.models.generate_content(
            model=settings.AI.get("GENAI_MODEL_IMAGE", "gemini-2.5-flash-image"),
            contents=[prompt],
            config=types.GenerateContentConfig(
                image_config=types.ImageConfig(aspect_ratio="16:9")
            ),
        )

        output_dir = Path(settings.MEDIA_ROOT) / "courses" / "thumbs"
        output_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4()}.png"
        output_path = output_dir / filename

        image_saved = False
        for part in response.parts:
            if part.inline_data is not None:
                image = part.as_image()
                image.save(output_path)
                image_saved = True
                break

        if not image_saved:
            # Tentar método alternativo
            if hasattr(response, "generated_images") and response.generated_images:
                image = response.generated_images[0].image
                image.save(output_path)
            else:
                raise ValueError("No image data in response")

        Course.objects.filter(pk=course_pk).update(thumb=output_path)

    except Exception as e:
        logger.error(f"Thumbnail creation failed: {e}")
        Course.objects.filter(pk=course_pk).update(status="ERROR")
        raise ThumbnailCreationError(f"Erro ao criar thumbnail: {str(e)}")
