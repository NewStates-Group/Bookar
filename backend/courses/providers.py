"""
AI Provider Chain of Responsibility.

Each provider tries to handle the request. If it fails, it delegates to the next
provider in the chain. If no provider succeeds, AllProvidersFailed is raised.

Usage:
    chain = get_text_chain()
    result = chain.handle(messages=[...])

    chain = get_image_chain()
    chain.handle(prompt="...", output_path=Path("..."), client=client)

    chain = get_audio_chain()
    chain.handle(text="...", output_path=Path("..."), client=client)
"""

from __future__ import annotations

import logging
import os
import subprocess
import uuid
import urllib.parse
import wave
from abc import ABC, abstractmethod
from io import BytesIO
from pathlib import Path
from typing import Any, Optional

import httpx
from django.conf import settings
from google.genai import types

logger = logging.getLogger(__name__)


class AllProvidersFailed(Exception):
    """Raised when every provider in the chain has failed."""
    pass


class BaseProvider(ABC):
    """Abstract handler in the Chain of Responsibility."""

    name: str = "base"
    _next: Optional[BaseProvider] = None

    def set_next(self, provider: BaseProvider) -> BaseProvider:
        """Set the next handler and return it (for chaining calls)."""
        self._next = provider
        return provider

    def handle(self, **kwargs) -> Any:
        try:
            logger.info(f"Attempting provider: {self.name}")
            result = self._execute(**kwargs)
            logger.info(f"Provider {self.name} succeeded.")
            return result
        except Exception as e:
            logger.warning(f"Provider {self.name} failed: {e}")
            if self._next:
                return self._next.handle(**kwargs)
            raise AllProvidersFailed(
                f"All providers failed. Last error ({self.name}): {e}"
            ) from e

    @abstractmethod
    def _execute(self, **kwargs) -> Any:
        """Provider-specific logic. Must raise on failure."""
        ...


class GeminiTextProvider(BaseProvider):
    name = "GenAI"

    def _execute(self, *, messages, model=None, **_kw) -> str:
        from .utils import safe_gemini_call, get_genai_client

        client = get_genai_client()
        if model is None:
            model = settings.AI.get("GENAI_MODEL_TEXT", "gemini-2.5-flash-lite")

        if isinstance(messages, list) and messages and isinstance(messages[-1], dict):
            prompt = messages[-1].get("content", "")
        else:
            prompt = str(messages)

        response = safe_gemini_call(
            client.models.generate_content,
            model=model,
            contents=prompt,
        )
        return response.text


class OllamaTextProvider(BaseProvider):
    name = "Ollama"

    def _execute(self, *, messages, **_kw) -> str:
        from ollama import Client as OllamaClient

        client = OllamaClient(
            host="https://ollama.com",
            headers={"Authorization": "Bearer " + settings.AI["OLLAMA_KEY"]},
        )
        if isinstance(messages, list):
            msgs = messages
        else:
            msgs = [{"role": "user", "content": str(messages)}]

        return client.chat(settings.AI["OLLAMA_MODEL_TEXT"], messages=msgs)["message"]["content"]


class GeminiImageProvider(BaseProvider):
    name = "GenAI"

    def _execute(self, *, prompt, output_path, client, timeout=30, **_kw) -> bool:
        from .utils import safe_gemini_call

        model_name = settings.AI.get("GENAI_MODEL_IMAGE", "gemini-2.5-flash-lite")

        if "imagen" in model_name.lower() or "generate" in model_name.lower():
            response = safe_gemini_call(
                client.models.generate_images,
                model=model_name,
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio="16:9",
                    output_mime_type="image/jpeg",
                ),
            )
            if not response or not response.generated_images:
                raise ValueError("Empty response from Gemini Images")
            for img in response.generated_images:
                output_path.write_bytes(img.image.image_bytes)
                return True
        else:
            response = safe_gemini_call(
                client.models.generate_content,
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    image_config=types.ImageConfig(aspect_ratio="16:9")
                ),
            )
            if not response or not response.parts:
                raise ValueError("Empty response from Gemini Content")

            for part in response.parts:
                if part.inline_data:
                    output_path.write_bytes(part.inline_data.data)
                    return True
                if hasattr(part, "image"):
                    data = (
                        part.image
                        if isinstance(part.image, bytes)
                        else getattr(part.image, "data", None)
                    )
                    if data:
                        output_path.write_bytes(data)
                        return True

        raise ValueError("No image part in response")


class ReplicateImageProvider(BaseProvider):
    name = "Replicate"

    def _execute(self, *, prompt, output_path, timeout=30, **_kw) -> bool:
        import replicate

        os.environ["REPLICATE_API_TOKEN"] = settings.AI.get("REPLICATE_API_TOKEN", "")
        output = replicate.run(
            "black-forest-labs/flux-schnell",
            input={"prompt": prompt, "aspect_ratio": "16:9"},
        )
        if not output:
            raise ValueError("No output from Replicate")

        url = output[0] if isinstance(output, list) else output
        with httpx.Client() as c:
            res = c.get(str(url), timeout=timeout)
            res.raise_for_status()
            output_path.write_bytes(res.content)
        return True


class PollinationsImageProvider(BaseProvider):
    name = "Pollinations"

    def _execute(self, *, prompt, output_path, timeout=30, **_kw) -> bool:
        encoded = urllib.parse.quote(prompt)
        seed = uuid.uuid4().int % 100000000
        url = f"https://image.pollinations.ai/prompt/{encoded}?width=1920&height=1080&nologo=true&seed={seed}"

        with httpx.Client() as c:
            res = c.get(url, timeout=timeout)
            res.raise_for_status()
            output_path.write_bytes(res.content)
        return True


class HuggingFaceImageProvider(BaseProvider):
    name = "HuggingFace"

    def _execute(self, *, prompt, output_path, timeout=30, **_kw) -> bool:
        token = settings.AI.get("HF_API_KEY", "")
        if not token:
            raise ValueError("HF_API_KEY not set")

        api_url = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0"
        headers = {"Authorization": f"Bearer {token}"}

        with httpx.Client() as c:
            res = c.post(api_url, headers=headers, json={"inputs": prompt}, timeout=timeout)
            res.raise_for_status()
            output_path.write_bytes(res.content)
        return True


def _save_pcm_as_wav(filename, pcm_bytes, channels=1, rate=24000, sample_width=2):
    """Write raw PCM bytes as a WAV file."""
    if pcm_bytes is None:
        raise ValueError("PCM bytes is None")
    with wave.open(str(filename), "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(rate)
        wf.writeframes(pcm_bytes)
    return True


class GeminiAudioProvider(BaseProvider):
    name = "Gemini TTS"

    def _execute(self, *, text, output_path, client, **_kw) -> bool:
        from .utils import safe_gemini_call

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

        raise ValueError("No audio data received from Gemini TTS")


class ElevenLabsAudioProvider(BaseProvider):
    name = "ElevenLabs"

    def _execute(self, *, text, output_path, **_kw) -> bool:
        api_key = settings.AI.get("ELEVENLABS_KEY", "")
        if not api_key:
            raise ValueError("ELEVENLABS_KEY not configured")

        voice_id = "onyx"
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        }

        with httpx.Client() as c:
            res = c.post(url, headers=headers, json=payload, timeout=60)
            res.raise_for_status()
            mp3_path = output_path.with_suffix(".mp3")
            mp3_path.write_bytes(res.content)

        # Convert MP3 → WAV for pipeline consistency
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(mp3_path),
                "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le",
                str(output_path),
            ],
            check=True,
            capture_output=True,
            timeout=30,
        )
        mp3_path.unlink(missing_ok=True)
        return True

def _build_chain(providers: list[BaseProvider]) -> BaseProvider:
    """Link a list of providers into a chain and return the head."""
    for i in range(len(providers) - 1):
        providers[i].set_next(providers[i + 1])
    return providers[0]


def get_text_chain(model=None) -> BaseProvider:
    """Build the text generation chain based on environment."""
    env = settings.AI.get("AI_ENVIRONMENT", "production")
    if env == "testing":
        return _build_chain([OllamaTextProvider(), GeminiTextProvider()])
    return _build_chain([GeminiTextProvider(), OllamaTextProvider()])


def get_image_chain() -> BaseProvider:
    """Build the image generation chain based on environment."""
    env = settings.AI.get("AI_ENVIRONMENT", "production")
    if env == "testing":
        return _build_chain([
            PollinationsImageProvider(),
            HuggingFaceImageProvider(),
            ReplicateImageProvider(),
            GeminiImageProvider(),
        ])
    return _build_chain([
        GeminiImageProvider(),
        ReplicateImageProvider(),
        PollinationsImageProvider(),
        HuggingFaceImageProvider(),
    ])


def get_audio_chain() -> BaseProvider:
    """Build the audio generation chain (same for all environments)."""
    return _build_chain([GeminiAudioProvider(), ElevenLabsAudioProvider()])
