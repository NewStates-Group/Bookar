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
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from pypdf import PdfReader, PdfWriter
from core.mail import send_certificate_email
import os
import io
import time
from django.core.files.base import ContentFile
from django.contrib.auth import get_user_model

from django.core.files.storage import default_storage
from google.genai import types
from PIL import Image, ImageDraw, UnidentifiedImageError

from .exceptions import LessonDoesNotExist, ThumbnailCreationError
from .models import Choice, Course, Lesson, Module, Question, Quiz, CourseGenerationContext
from .utils import (
    extract_json,
    get_genai_client,
    genai_chat,
    safe_gemini_call,
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
        response = safe_gemini_call(
            client.models.generate_content,
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
        model_name = settings.AI.get("GENAI_MODEL_IMAGE", "gemini-2.5-flash-lite")
        
        # Log the attempt
        logger.info(f"Generating image with model {model_name} for prompt: {prompt[:50]}...")
        
        response = safe_gemini_call(
            client.models.generate_content,
            model=model_name,
            contents=img_prompt,
            config=types.GenerateContentConfig(
                image_config=types.ImageConfig(aspect_ratio="16:9")
            ),
        )
        
        if not response or not response.parts:
            raise ValueError("Empty response from Gemini")
            
        for part in response.parts:
            if part.inline_data:
                output_path.write_bytes(part.inline_data.data)
                return True
            # Some versions might return just 'image' or similar, though SDK usually gives inline_data
            if hasattr(part, 'image'):
                 # Check if part.image is bytes or have .data
                 data = part.image if isinstance(part.image, bytes) else getattr(part.image, 'data', None)
                 if data:
                     output_path.write_bytes(data)
                     return True
        raise ValueError("No image part in response")
    except Exception as e:
        logger.warning(f"Image generation failed for '{prompt[:50]}...': {str(e)}")
        # If it's a BadRequest, it might be the config. Let's try once without image_config as a last resort
        if "BadRequest" in str(e) or "400" in str(e):
             try:
                logger.info("Retrying without image_config...")
                response = safe_gemini_call(
                    client.models.generate_content,
                    model=model_name,
                    contents=img_prompt,
                )
                for part in response.parts:
                    if part.inline_data:
                        output_path.write_bytes(part.inline_data.data)
                        return True
             except Exception as retry_e:
                logger.warning(f"Retry without config also failed: {retry_e}")

        logger.info("Using fallback image.")
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

    # Concurrency restored to 2 for parallel audio/image generation
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        audio_future = pool.submit(_generate_audio, client, narration, audio)
        image_future = pool.submit(_generate_image, client, visual, image)

        if not audio_future.result():
            return None
        image_future.result()

    if not _stitch_video(image, audio, video):
        return None
    return video


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3}, default_retry_delay=40)
def generate_lesson(self, user_id, lesson_id: int):
    lesson = Lesson.objects.filter(id=lesson_id).first()
    if not lesson:
        raise LessonDoesNotExist()

    if lesson.status == "READY":
        logger.info(f"Lesson {lesson_id} already READY, skipping generation.")
        return lesson.lesson_file

    # if Lesson.objects.filter(
    #     module__course__user_id=user_id, status="PROCESSING"
    # ).exclude(id=lesson_id).exists():
    #     raise RuntimeError("Only one lesson at a time")

    lesson.status = "PROCESSING"
    lesson.save(update_fields=["status"])

    # Check for cancellation before starting heavy work
    lesson.refresh_from_db()
    if lesson.status == "CANCELLED" or lesson.module.course.status == "CANCELLED":
        logger.info(f"Lesson {lesson_id} generation cancelled early.")
        return None

    temp_dir = Path(tempfile.mkdtemp())
    client = get_genai_client()
    try:
        plan_prompt = f"""
        Title: {lesson.title}
        Description: {lesson.desc}
        Context: {lesson.narration}
        **USE PORTUGUESE ON THE JSON VALUES**
        **KEYS MUST KEEP THE ORIGINAL ENGLISH NAMES**
        Generate EXACTLY 4 or 5 segments (no more, no less). Quality over quantity.
        Each narration should cover 1-3 minutes of content.
        Generate a JSON list of segments:
        [
        {{
            "narration": "...",
            "visual_prompt": "A simple image scene description for this part..."
        }}
        ]
        """

        response = genai_chat([{"role": "user", "content": plan_prompt}])
        segments = (extract_json(response, isList=True) or [])[:5]  # hard cap at 5

        if not segments:
            raise ValueError("No segments generated")

        # --- RESTORED PARALLEL PROCESSING ---
        videos = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [
                executor.submit(_process_segment, i, seg, client, temp_dir)
                for i, seg in enumerate(segments)
            ]
            for future in concurrent.futures.as_completed(futures):
                try:
                    video_path = future.result()
                    if video_path:
                        videos.append(video_path)
                except Exception as e:
                    logger.error(f"Segment processing failed: {e}")

        # Sort videos by segment index (s0.mp4, s1.mp4, etc.)
        videos.sort(key=lambda x: int(x.stem[1:]) if x.stem.startswith('s') else 999)

        if not videos:
            raise RuntimeError("No video segments created")

        logo_path = settings.BASE_DIR / "static" / "logo.png"

        list_file = temp_dir / "list.txt"
        list_file.write_text("\n".join(f"file '{v}'" for v in videos))
        
        # Keep everything in temp_dir to avoid polluting MEDIA_ROOT/Cloudinary
        concat_output = temp_dir / "concat_output.mp4"
        final_temp_output = temp_dir / "final_output.mp4"

        # Step 1: Concatenate segments
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
                str(concat_output),
            ],
            check=True,
            timeout=15*60,
        )

        # Step 2: Add logo overlay
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i", str(concat_output),
                "-i", str(logo_path),
                "-filter_complex", "[1:v]scale=iw*0.08:-1[logo];[logo]format=rgba[logo];[0:v][logo]overlay=20:20",
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                "-b:a", "128k",
                str(final_temp_output),
            ],
            check=True,
            timeout=15*60,
        )

        final_filename = f"{uuid.uuid4()}.mp4"
        with final_temp_output.open("rb") as f:
            lesson.lesson_file.save(final_filename, ContentFile(f.read(), name=final_filename), save=False)
        
        lesson.status = "READY"
        lesson.save()

        return lesson.lesson_file.url if lesson.lesson_file else None
    except Exception as e:
        lesson.status = "ERROR"
        lesson.save(update_fields=["status"])
        raise e
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3}, default_retry_delay=40)
def generate_next_module(self, user_pk: int, course_pk: int, module_pk: int = None):
    try:
        course = Course.objects.get(pk=course_pk)
        if course.status == "CANCELLED":
            logger.info(f"Course {course_pk} next module generation cancelled.")
            return
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
        
        # Generate only the first lesson of the module; others will be triggered sequentially
        first_lesson = Lesson.objects.filter(module=module_object, status="PENDING").order_by("id").first()
        if first_lesson:
             generate_lesson.delay(user_pk, first_lesson.id)

        # For the first module, mark course as READY to show in dashboard
        if course.modules.count() == 1:
            
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


@shared_task(autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3}, default_retry_delay=40)
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



@shared_task(autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3}, default_retry_delay=40)
def create_course_details(user_id: int, course_pk: int, prompt: str, level: str):
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
        course = Course.objects.get(pk=course_pk)
        if course.status == "CANCELLED":
            logger.info(f"Course {course_pk} generation cancelled.")
            return

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

    Course.objects.filter(pk=course_pk).update(
        desc=course_desc, title=course_title, max_modules=max_modules, status="PROCESSING"
    )

    # Save generation context for future reuse
    CourseGenerationContext.objects.update_or_create(
        course=course,
        defaults={
            "prompt": prompt,
            "system_prompt": ai_prompt,
            "response": response
        }
    )
    
    # Trigger thumbnail and module generation in parallel
    create_course_thumb.delay(course_pk, prompt)
    generate_next_module.delay(user_id, course_pk)


@shared_task(autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3}, default_retry_delay=40)
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
        course = Course.objects.get(pk=course_pk)
        if course.status == "CANCELLED":
            logger.info(f"Course {course_pk} thumbnail generation cancelled.")
            return

        response = safe_gemini_call(
            client.models.generate_content,
            model=settings.AI.get("GENAI_MODEL_IMAGE", "gemini-2.5-flash-lite"),
            contents=[ai_prompt],
            config=types.GenerateContentConfig(
                image_config=types.ImageConfig(aspect_ratio="16:9")
            ),
        )

        image_data = None
        for part in response.parts:
            if part.inline_data:
                image_data = part.inline_data.data
                break
            if hasattr(part, 'image'):
                image_data = part.image if isinstance(part.image, bytes) else getattr(part.image, 'data', None)
                if image_data: break

        if not image_data:
            raise ThumbnailCreationError("IA não retornou uma imagem válida")

        try:
            image = Image.open(BytesIO(image_data))
            image.verify()
            image = Image.open(BytesIO(image_data)).convert("RGBA")
        except Exception as e:
            logger.error(f"Image processing error: {e}")
            raise ThumbnailCreationError("Conteúdo retornado não é uma imagem válida")

        logo_path = settings.BASE_DIR / "static" / "logo.png"
        if logo_path.exists():
            logo = Image.open(logo_path).convert("RGBA")
            img_width, img_height = image.size
            logo_width = int(img_width * 0.08)
            logo_ratio = logo_width / logo.width
            logo_height = int(logo.height * logo_ratio)

            logo = logo.resize((logo_width, logo_height), Image.Resampling.LANCZOS)

            margin = int(img_width * 0.03)
            position = (margin, margin)

            image.paste(logo, position, logo)
        else:
            logger.warning(f"Logo not found at {logo_path}, skipping overlay")
        image = image.convert("RGB")

        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=90)
        buffer.seek(0)

        thumb_filename = f"{uuid.uuid4()}.jpg"
        # Passing name to ContentFile is good practice for some storage backends
        course.thumb.save(thumb_filename, ContentFile(buffer.getvalue(), name=thumb_filename), save=True)
        course.status = "READY"
        course.save()
        # Thumbnail generation is now independent of module generation
        # generate_next_module.delay(course.user.pk, course_pk)
    except Exception as e:
        logger.error(f"Thumbnail creation failed: {e}")
        Course.objects.filter(pk=course_pk).update(status="FAILED")
        raise ThumbnailCreationError(f"Erro ao criar thumbnail: {str(e)}") 
@shared_task(autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3}, default_retry_delay=40)
def generate_certificate_task(user_id: int, course_id: int, full_name: str):
    from .models import Course, CourseEnrollment
    from PIL import Image
    import io
    import uuid
    from django.core.files.base import ContentFile
    from google.genai import types

    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
        course = Course.objects.get(pk=course_id)
        client = get_genai_client()
        # 1. Calculate real duration
        from django.db.models import Sum
        total_seconds = course.modules.aggregate(
            total=Sum('lessons__duration')
        )['total'] or 0
        total_hours = max(1, round(total_seconds / 3600))
        duration_str = f"{total_hours} horas" if total_hours > 1 else "1 hora"

        # 2. Get current date in DD/MM/YYYY
        from datetime import datetime
        data_actual = datetime.now().strftime("%d/%m/%Y")

        # 3. Load base image
        base_path = settings.BASE_DIR / "static" / "certificate_base.png"
        if not base_path.exists():
            raise FileNotFoundError(f"Base certificate image not found at {base_path}")
            
        base_img = Image.open(base_path)
        
        # 4. Prepare multimodal prompt
        prompt = f"""
        Utilize a imagem fornecida como REFERÊNCIA DE ESTILO para criar um certificado de conclusão NOVO, MODERNO e PROFISSIONAL.
        
        O certificado gerado deve conter OBRIGATORIAMENTE os seguintes elementos de texto (você tem liberdade para ajustar o layout, fontes e espaçamentos para que tudo fique perfeitamente alinhado e legível):
        
        1. **Cabeçalho**: Logo da "BOOKAR" e o título "CERTIFICADO DE CONCLUSÃO".
        2. **Chamada**: O texto "CERTIFICAMOS QUE".
        3. **Nome do Aluno**: "{full_name.upper()}" (deve estar em grande destaque, no centro, com uma fonte elegante).
        4. **Corpo do Texto**: "Concluiu o curso de **{course.title}** ministrado pela plataforma **Bookar**, com carga de **{duration_str}**." (O nome do curso e a carga horária devem estar em negrito/destaque).
        5. **Rodapé**: Inclua o texto "Bookar.study - ENSINO BASEADO EM IA" no canto inferior esquerdo e "EMITIDO EM {data_actual}" no canto inferior direito.
        
        Instruções de Estilo:
        - Mantenha a paleta de cores e o "feeling" da imagem de referência.
        - Você pode modificar levemente a posição dos elementos para garantir que o nome do curso e o nome do aluno caibam perfeitamente sem sobreposições.
        - O design deve ser limpo, minimalista e premium.
        - A imagem final deve ter alta qualidade (1600x1000).
        """
        
        model_name = settings.AI.get("GENAI_MODEL_IMAGE", "gemini-2.0-flash")

        response = safe_gemini_call(
            client.models.generate_content,                                                                                                     
            model=model_name,
            contents=[base_img, prompt],
            config=types.GenerateContentConfig(
                image_config=types.ImageConfig(aspect_ratio="16:9")
            ),
        )

        image_data = None
        if hasattr(response, 'parts'):
            for part in response.parts:
                if part.inline_data:
                    image_data = part.inline_data.data
                    break
                if hasattr(part, 'image'):
                    image_data = part.image if isinstance(part.image, bytes) else getattr(part.image, 'data', None)
                    if image_data: break

        if not image_data:
             # Fallback to the text-based drawing if image generation modality is not supported by the model
             # or returned nothing. But given the user's frustration, we must try to get an image.
             # If response has text but no image, maybe the model didn't support image generation.
             raise ValueError(f"IA não retornou uma imagem para o certificado. Resposta: {getattr(response, 'text', 'Sem texto')}")

        # 3. Save to Database/Cloudinary
        enrollment = CourseEnrollment.objects.get(course=course, user=user)
        cert_filename = f"cert_{course.id}_{user.id}_{uuid.uuid4().hex[:8]}.png"
        enrollment.certificate_file.save(cert_filename, ContentFile(image_data, name=cert_filename), save=False)
        enrollment.certificate_status = "READY"
        enrollment.save()
        
        send_certificate_email(user, course, enrollment.certificate_file.url)
        return enrollment.certificate_file.url

    except Exception as e:
        logger.error(f"Certificate generation failed: {e}")
        try: CourseEnrollment.objects.filter(course_id=course_id, user_id=user_id).update(certificate_status="FAILED")
        except: pass
        raise e


    except Exception as e:
        logger.error(f"Certificate generation failed: {e}")
        try: CourseEnrollment.objects.filter(course_id=course_id, user_id=user_id).update(certificate_status="FAILED")
        except: pass
        raise e

