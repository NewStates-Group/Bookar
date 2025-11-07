import json
import os
import textwrap
from time import sleep, time

import pyttsx3
from django.conf import settings
from django.utils.text import slugify
from google.genai import Client as GenaiCLient
from gradio_client import Client as GradioClient
from moviepy import AudioFileClip, ImageClip, concatenate_videoclips, vfx
from ollama import Client as OllamaClient
from PIL import Image, ImageDraw, ImageFont

ollama_client = OllamaClient(
    host="https://ollama.com",
    headers={
        "Authorization": "Bearer edeb6900fdab480fa5038618260f04d7.gIzDAUDp-Vx90Te-H4aGpT9j"
    },
)
gen_client = GenaiCLient(api_key="AIzaSyBOCaaq8ZrunHix1E-IdCxm3CjWcdBlBXE")


def generate_course_outline(data):
    messages = [
        {
            "role": "system",
            "content": (
                "Você é um criador de roteiros educacionais multimídia. "
                "Gere um plano de curso JSON seguindo a estrutura: "
                "{title:str, desc:str, level:str, modules:list[dict]}. "
                "Cada módulo deve conter: {title:str, desc:str, lessons:list[dict]}, "
                "e cada aula deve conter {title:str, desc:str, duration_seconds: int, narration:str, key_points:list[str], scene_suggestion:str}. "
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
                f"A tag do curso é {data.tag}. "
                "Inclua pelo menos 3 módulos, cada módulo com pelo menos 2 a 5 aulas. "
                "Cada aula deve conter 'narration' e 'scene_suggestion' para vídeos."
            ),
        },
    ]
    response_text = ""
    for part in ollama_client.chat(
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
    return course_outline


def google_generate_course_thumb(data):
    response = gen_client.models.generate_content(
        model="gemini-2.5-flash-image",
        contents=[
            f"Generate a thumb for this course {data.title}. Description: {data.desc}. level {data.level}"
        ],
    )

    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            return part.inline_data.data


def google_generate_course_lesson(lesson):
    operation = gen_client.models.generate_videos(
        model="veo-3.1-generate-preview",
        prompt=(
            "Cria uma videoaula baseada em slides. "
            "Mostre um avatar apresentador no canto superior esquerdo. "
            f"Título da aula: {lesson['title']}. "
            f"Descrição: {lesson['desc']}. "
            f"Narração: {lesson['narration']}. "
            f"Pontos-chave: {lesson['key_points']}. "
            f"Sugestões de cenas: {lesson['scene_suggestion']}. "
            "O vídeo deve parecer profissional e educativo."
        ),
        config={
            "aspect_ratio": "16:9",
            "duration_seconds": lesson["duration_seconds"],
            "generate_audio": True,
        },
    )
    while not operation.done:
        sleep(10)
        operation = gen_client.operations.get(operation)
    video_info = operation.response.generated_videos[0]
    video_file = gen_client.files.download(file=video_info.video)
    return video_file.read()


def time_based_name(name: str) -> str:
    return slugify(f"{name}-{int(time())}")


def generate_course_thumb(data):
    client = GradioClient(
        "stabilityai/stable-diffusion-3.5-large",
        hf_token="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",
        download_files=settings.MEDIA_ROOT / "courses" / "thumbs",
    )

    prompt = (
        f"Professional educational course thumbnail for '{data.title}'. "
        f"Description: {data.desc}. Level: {data.level}. "
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


def generate_course_lesson(lesson):
    tts = pyttsx3.init()
    filename = time_based_name(lesson["title"])

    audio_dir = settings.MEDIA_ROOT / "courses" / "audios"
    slides_dir = settings.MEDIA_ROOT / "courses" / "slides"
    lessons_dir = settings.MEDIA_ROOT / "courses" / "lessons"
    for d in [audio_dir, slides_dir, lessons_dir]:
        d.mkdir(parents=True, exist_ok=True)

    slides = []
    audio_path = audio_dir / f"{filename}.mp3"
    voices = tts.getProperty("voices")
    pt_voice_id = None
    for voice in voices:
        lang = getattr(voice, "languages", [])
        if any("pt" in str(l) for l in lang) or "brazil" in str(voice.name).lower():
            pt_voice_id = voice.id
            break
    if pt_voice_id:
        tts.setProperty("voice", pt_voice_id)
    tts.save_to_file(lesson["narration"], str(audio_path))
    tts.runAndWait()

    while not audio_path.exists():
        sleep(3)
    lines = textwrap.wrap(lesson["desc"], width=60)
    img = Image.new("RGB", (1280, 720), color=(245, 245, 245))
    draw = ImageDraw.Draw(img)

    font_title = ImageFont.load_default()
    font_text = ImageFont.load_default()

    draw.text((50, 50), lesson["title"], fill=(0, 0, 0), font=font_title)
    y = 150
    for line in lines:
        draw.text((50, y), line, fill=(60, 60, 60), font=font_text)
        y += 45

    slide_path = slides_dir / f"{filename}.png"
    img.save(slide_path)
    slides.append(slide_path)

    audio_clip = AudioFileClip(audio_path)
    num_slides = len(slides)
    duration_per_slide = audio_clip.duration / num_slides
    slide_clips = []

    for slide in slides:
        clip = ImageClip(slide).with_duration(duration_per_slide)
        clip = clip.with_effects([vfx.FadeIn(1), vfx.FadeOut(1)])
        slide_clips.append(clip)
    final_clip = concatenate_videoclips(slide_clips, method="compose").with_audio(
        audio_clip
    )
    output_path = lessons_dir / f"{filename}.mp4"
    final_clip.write_videofile(output_path, fps=24, codec="libx264", audio_codec="aac")
    return output_path
