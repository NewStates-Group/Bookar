import base64
import json
import logging
import re
import tempfile
import uuid
from pathlib import Path

import httpx
from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from courses.providers import AllProvidersFailed, get_audio_chain, get_text_chain
from courses.utils import get_genai_client
from django.conf import settings
from google.genai import types
from django.contrib.auth import get_user_model
from ninja_jwt.tokens import AccessToken
from elevenlabs import ElevenLabs
from . import presence as room_presence
from .models import ExplicadorRoom

from courses.providers import NvidiaAudioProvider

logger = logging.getLogger(__name__)


# async def generate_elevenlabs_audio(text: str) -> str:
#     api_key = settings.AI.get("ELEVENLABS_KEY", "")
#     if not api_key:
#         logger.warning("ELEVENLABS_KEY not configured, skipping audio generation.")
#         return ""

#     voice_id = "onyx"
#     url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
#     headers = {
#         "xi-api-key": api_key,
#         "Content-Type": "application/json",
#         "Accept": "audio/mpeg",
#     }
#     # Clean text to remove markdown markers for cleaner speech
#     clean_text = re.sub(r"\*\*.*?\*\*|#+ |`.*?`|\[.*?\]\(.*?\)", "", text)
#     clean_text = clean_text.replace("\n", " ").strip()

#     payload = {
#         "text": clean_text[:1000],  # Limit to 1000 chars to avoid huge costs/timeouts
#         "model_id": "eleven_multilingual_v2",
#         "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
#     }

#     try:
#         async with httpx.AsyncClient() as client:
#             response = await client.post(url, headers=headers, json=payload, timeout=30.0)
#             if response.status_code == 200:
#                 audio_base64 = base64.b64encode(response.content).decode("utf-8")
#                 return f"data:audio/mp3;base64,{audio_base64}"
#             else:
#                 logger.error(f"ElevenLabs TTS failed: {response.status_code} - {response.text}")
#     except Exception as e:
#         logger.error(f"Error calling ElevenLabs: {e}")

#     return ""

def _audio_to_data_uri(audio_bytes: bytes, mime: str = "audio/mpeg") -> str:
    return f"data:{mime};base64," + base64.b64encode(audio_bytes).decode()


def generate_elevenlabs_audio(text: str) -> str:
    text = text[:1000]

    # 1. Try ElevenLabs directly
    # api_key = settings.AI.get("ELEVENLABS_KEY", "")
    # if api_key:
    #     try:
    #         client = ElevenLabs(api_key=api_key, timeout=30)
    #         audio = client.text_to_speech.convert(
    #             text=text,
    #             voice_id="JBFqnCBsd6RMkjVDRZzb",
    #             model_id="eleven_multilingual_v2",
    #             output_format="mp3_44100_128",
    #         )
    #         return _audio_to_data_uri(b"".join(audio), "audio/mpeg")
    #     except Exception as e:
    #         logger.warning("ElevenLabs TTS failed, trying fallback: %s", e)

    # 2. Fallback to audio chain (Gemini TTS → NVIDIA Riva)
    if not settings.AI.get("GENAI_KEY") and not settings.AI.get("NVIDIA_AUDIO_API_KEY"):
        logger.warning("No fallback TTS configured")
        return ""

    try:
        chain = get_audio_chain()
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        chain.handle(text=text, output_path=tmp_path)
        wav_bytes = tmp_path.read_bytes()
        tmp_path.unlink(missing_ok=True)
        return _audio_to_data_uri(wav_bytes, "audio/wav")
    except AllProvidersFailed as e:
        logger.error("All TTS providers failed: %s", e)
        return ""

User = get_user_model()

EXPLICADOR_MENTION = "@explicador"


def message_mentions_explicador(text: str) -> bool:
    return EXPLICADOR_MENTION in text.lower()


def strip_explicador_mention(text: str) -> str:
    cleaned = re.sub(r"@explicador\s*", "", text, flags=re.IGNORECASE).strip()
    return cleaned


def sanitize_whiteboard_data(whiteboard_data: dict | None) -> dict:
    """Remove transient flags before persisting or broadcasting whiteboard state."""
    data = dict(whiteboard_data or {})
    data.pop("open_whiteboard", None)
    return data


def should_auto_open_whiteboard(
    user_prompt: str, new_summary: str, previous_summary: str, ai_wants_open: bool
) -> bool:
    """Open board only for substantive new visual content, not social/chat-only replies."""
    new_summary = (new_summary or "").strip()
    previous_summary = (previous_summary or "").strip()
    if not ai_wants_open or not new_summary:
        return False
    if new_summary == previous_summary:
        return False

    text = user_prompt.lower().strip()
    if len(text) <= 60:
        social_markers = (
            "obrigad",
            "agradeç",
            "agradeço",
            "valeu",
            "thanks",
            "thank you",
            "ok",
            "okay",
            "entendi",
            "perfeito",
            "ótimo",
            "otimo",
            "boa",
            "olá",
            "ola",
            "oi",
            "tchau",
            "adeus",
            "certo",
            "sim",
            "não",
            "nao",
        )
        if any(marker in text for marker in social_markers):
            return False
    return True


class ExplicadorConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_uuid = self.scope["url_route"]["kwargs"]["room_uuid"]

        # Authenticate using token from query string
        query_string = self.scope.get("query_string", b"").decode("utf-8")
        params = dict(x.split("=") for x in query_string.split("&") if "=" in x)
        token_str = params.get("token")

        self.user = await self.get_user(token_str)
        self.room = await self.get_room(self.room_uuid)

        if not self.room:
            logger.warning(f"Room {self.room_uuid} not found")
            await self.close()
            return

        self.connection_id = str(uuid.uuid4())
        self.is_owner = self.user.is_authenticated and (
            self.room.owner_id == self.user.id
        )
        self.is_interrupted = False
        self.group_name = f"explicador_{self.room_uuid}"

        # Resolve user name and avatar
        self.user_name = (
            f"{self.user.first_name} {self.user.last_name}".strip()
            or self.user.username
            if self.user.is_authenticated
            else "Visitante"
        )
        avatar_url = None
        if (
            self.user.is_authenticated
            and hasattr(self.user, "avatar")
            and self.user.avatar
        ):
            try:
                avatar_url = self.user.avatar.url
            except Exception:
                pass
        self.user_avatar = avatar_url
        self.user_id = self.user.id if self.user.is_authenticated else None

        # Check participants limit before joining
        if self.user.is_authenticated and not self.is_owner:
            current_members = await sync_to_async(room_presence.list_members)(self.room_uuid)
            if current_members:
                from accounts.subscription_service import SubscriptionService
                from ninja.errors import HttpError as NinjaHttpError
                owner_id = self.room.owner_id
                try:
                    await sync_to_async(
                        lambda: SubscriptionService().check_limit(
                            User.objects.get(id=owner_id),
                            "explicador_participants",
                            len(current_members),
                        )
                    )()
                except NinjaHttpError:
                    await self.close()
                    return

        member_payload = {
            "connection_id": self.connection_id,
            "name": self.user_name,
            "avatar": self.user_avatar,
            "user_id": self.user_id,
            "is_owner": self.is_owner,
            "is_mic_on": False,
            "is_listening": True,
        }
        members = await sync_to_async(room_presence.add_member)(
            self.room_uuid,
            self.connection_id,
            member_payload,
            self.user_id,
        )

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.send(
            text_data=json.dumps(
                {
                    "type": "welcome",
                    "connection_id": self.connection_id,
                    "is_owner": self.is_owner,
                    "whiteboard_data": sanitize_whiteboard_data(
                        self.room.whiteboard_data
                    ),
                    "chat_history": self.room.chat_history,
                    "members": members,
                }
            )
        )

        await self._broadcast_presence_sync()

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await sync_to_async(room_presence.remove_member)(
                self.room_uuid, self.connection_id
            )

            # Check if this connection held the lock
            self.room = await self.get_room(self.room_uuid)
            if self.room:
                lock = self.room.whiteboard_data.get("lock")
                if lock and lock.get("connection_id") == self.connection_id:
                    self.room.whiteboard_data["lock"] = None
                    await self.save_room()

                    await self.channel_layer.group_send(
                        self.group_name,
                        {
                            "type": "broadcast_message",
                            "message": {
                                "type": "chat_update",
                                "chat_history": self.room.chat_history,
                                "whiteboard_data": sanitize_whiteboard_data(
                                    self.room.whiteboard_data
                                ),
                            },
                        },
                    )

            await self._broadcast_presence_sync()

            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):  # type: ignore
        try:
            data = json.loads(text_data)
        except Exception:
            logger.error("Failed to parse payload")
            return

        action_type = data.get("type")
        if action_type == "request_presence":
            await self.handle_request_presence()
        else:
            handler = self.get_handler(action_type)
            if handler:
                await handler(data)

    def get_handler(self, action_type: str):
        return getattr(self, f"handle_{action_type}", None)

    async def _get_room_members(self) -> list:
        return await sync_to_async(room_presence.list_members)(self.room_uuid)

    async def _is_solo_room(self) -> bool:
        return len(await self._get_room_members()) <= 1

    async def _clear_lock_if_solo(self) -> None:
        """Remove pencil lock when only one person remains in the room."""
        if not await self._is_solo_room():
            return
        self.room = await self.get_room(self.room_uuid)
        if not self.room or not self.room.whiteboard_data.get("lock"):
            return
        self.room.whiteboard_data["lock"] = None
        await self.save_room()
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_message",
                "message": {
                    "type": "chat_update",
                    "chat_history": self.room.chat_history,
                    "whiteboard_data": sanitize_whiteboard_data(
                        self.room.whiteboard_data
                    ),
                },
            },
        )

    async def handle_grab_lock(self, data):
        """Allows a user to grab the pencil (lock) to send messages to the explicador"""
        if await self._is_solo_room():
            return

        # Refresh room data
        self.room = await self.get_room(self.room_uuid)
        if not self.room:
            return

        lock = self.room.whiteboard_data.get("lock")
        if not lock:
            user_name = (
                f"{self.user.first_name} {self.user.last_name}".strip() # type: ignore
                or self.user.username
                if self.user.is_authenticated
                else "Visitante"
            )
            self.room.whiteboard_data["lock"] = {
                "connection_id": self.connection_id,
                "name": user_name,
            }
            await self.save_room()

            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "broadcast_message",
                    "message": {
                        "type": "chat_update",
                        "chat_history": self.room.chat_history,
                        "whiteboard_data": sanitize_whiteboard_data(
                            self.room.whiteboard_data
                        ),
                    },
                },
            )

    async def handle_request_pencil(self, data):
        """Notifies the current lock holder that someone wants the pencil."""
        if await self._is_solo_room():
            return

        self.room = await self.get_room(self.room_uuid)
        if not self.room:
            return

        lock = self.room.whiteboard_data.get("lock")
        if not lock:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": "Ninguém tem o lápis agora.",
                    }
                )
            )
            return

        lock_holder_id = lock.get("connection_id")
        if lock_holder_id == self.connection_id:
            return

        allowed, wait_seconds = await self._check_pencil_request_rate_limit()
        if not allowed:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": (
                            f"Aguarde {wait_seconds}s para pedir o lápis novamente."
                        ),
                    }
                )
            )
            return

        requester_name = data.get("name") or (
            f"{self.user.first_name} {self.user.last_name}".strip()  # type: ignore
            or getattr(self.user, "username", "Visitante")
            if self.user.is_authenticated
            else "Visitante"
        )

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_message",
                "message": {
                    "type": "pencil_request",
                    "target_connection_id": lock_holder_id,
                    "requester_name": requester_name,
                    "requester_connection_id": self.connection_id,
                },
            },
        )

    async def handle_release_lock(self, data):
        """Allows the current lock holder to release the chalk"""
        if await self._is_solo_room():
            return

        # Refresh room data
        self.room = await self.get_room(self.room_uuid)
        if not self.room:
            return

        lock = self.room.whiteboard_data.get("lock")
        if lock and lock.get("connection_id") == self.connection_id:
            self.room.whiteboard_data["lock"] = None
            await self.save_room()

            # Broadcast new lock state to the room
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "broadcast_message",
                    "message": {
                        "type": "chat_update",
                        "chat_history": self.room.chat_history,
                        "whiteboard_data": sanitize_whiteboard_data(
                            self.room.whiteboard_data
                        ),
                    },
                },
            )

    async def handle_interrupt(self, data):
        """Allows the client to interrupt an ongoing AI generation.
        In multi-user rooms, only the pencil (lock) holder can interrupt."""
        if not await self._is_solo_room():
            self.room = await self.get_room(self.room_uuid)
            if self.room:
                lock = self.room.whiteboard_data.get("lock")
                if not lock or lock.get("connection_id") != self.connection_id:
                    await self.send(
                        text_data=json.dumps(
                            {
                                "type": "error",
                                "message": "Só quem tem o lápis pode interromper o explicador.",
                            }
                        )
                    )
                    return

        self.is_interrupted = True
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_message",
                "message": {
                    "type": "chat_update",
                    "chat_history": self.room.chat_history,
                    "whiteboard_data": sanitize_whiteboard_data(
                        self.room.whiteboard_data
                    ),
                    "is_generating": False,
                },
            },
        )

    async def handle_voice_broadcast_start(self, data):
        """Broadcasts that a user has started a voice broadcast, so all other mics must mute."""
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_message",
                "message": {
                    "type": "voice_broadcast_started",
                    "speaker_connection_id": self.connection_id,
                },
            },
        )

    async def handle_voice_broadcast_end(self, data):
        """Broadcasts that the voice broadcast has ended, releasing the mute state for all."""
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_message",
                "message": {
                    "type": "voice_broadcast_ended",
                },
            },
        )

    async def _check_message_limit(self, user_id: int):
        from accounts.subscription_service import SubscriptionService

        def _check():
            svc = SubscriptionService()
            svc.check_and_increment(user_id, "explicador_message")

        try:
            await sync_to_async(_check)()
        except Exception as e:
            error_msg = str(e)
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": error_msg,
                    }
                )
            )
            raise

    async def handle_chat_message(self, data):
        """Processes chat messages. Lock is required only for @explicador messages."""
        self.is_interrupted = False
        self.room = await self.get_room(self.room_uuid)
        if not self.room:
            return

        message_content = data.get("message", "").strip()
        attachment_data = data.get("attachment")

        if not message_content and not attachment_data:
            return

        # Check subscription message limit
        if self.user.is_authenticated:
            try:
                await self._check_message_limit(self.user.id)
            except Exception:
                return

        solo_room = await self._is_solo_room() or bool(
            data.get("direct_to_explicador")
        )

        attachment_obj = None
        if attachment_data and isinstance(attachment_data, dict):
            size = attachment_data.get("size", 0)
            if size > 5 * 1024 * 1024:
                await self.send(
                    text_data=json.dumps(
                        {
                            "type": "error",
                            "message": "O ficheiro excede o limite de 5 MB.",
                        }
                    )
                )
                return

            base64_str = attachment_data.get("base64", "")
            if base64_str:
                try:
                    if "," in base64_str:
                        _, base64_data = base64_str.split(",", 1)
                    else:
                        base64_data = base64_str
                    file_bytes = base64.b64decode(base64_data)
                    attachment_obj = {
                        "data": file_bytes,
                        "mime_type": attachment_data.get("mime_type", "application/octet-stream"),
                        "name": attachment_data.get("name", "ficheiro"),
                        "url": base64_str
                    }
                except Exception as e:
                    logger.error(f"Failed to decode attachment: {e}")

        # An attachment automatically triggers the tutor/AI explanation
        if attachment_obj:
            mentions_tutor = True
        else:
            mentions_tutor = False

        if solo_room:
            if not attachment_obj:
                mentions_tutor = True
            user_name = self.user_name
            prompt_for_ai = (
                strip_explicador_mention(message_content) or message_content
            )
        else:
            if not attachment_obj:
                mentions_tutor = message_mentions_explicador(message_content)
            lock = self.room.whiteboard_data.get("lock")

            if mentions_tutor:
                if not lock or lock.get("connection_id") != self.connection_id:
                    await self.send(
                        text_data=json.dumps(
                            {
                                "type": "error",
                                "message": "Precisas de pegar o lápis primeiro para falar com o explicador.",
                            }
                        )
                    )
                    return
                user_name = lock.get("name", "Usuário")
            else:
                user_name = self.user_name

            prompt_for_ai = (
                strip_explicador_mention(message_content) if mentions_tutor else ""
            )

        display_content = message_content
        if not display_content and attachment_obj:
            display_content = f"Enviou um anexo: {attachment_obj['name']}"

        user_msg = {"role": "user", "content": f"**[{user_name}]**: {display_content}"}
        if attachment_obj:
            user_msg["attachment"] = {
                "name": attachment_obj["name"],
                "mime_type": attachment_obj["mime_type"],
                "url": attachment_obj["url"]
            }

        self.room.chat_history.append(user_msg)
        await self.save_room()

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_message",
                "message": {
                    "type": "chat_update",
                    "chat_history": self.room.chat_history,
                    "whiteboard_data": sanitize_whiteboard_data(
                        self.room.whiteboard_data
                    ),
                    "is_generating": mentions_tutor,
                },
            },
        )

        if not mentions_tutor:
            return

        if not prompt_for_ai:
            if attachment_obj:
                prompt_for_ai = f"Analise o ficheiro em anexo: {attachment_obj['name']}"
            else:
                prompt_for_ai = "Olá, estou disponível para ajudar. Em que posso esclarecer as tuas dúvidas?"

        # 2. Call AI only when @explicador is mentioned or attachment is present
        try:
            ai_response = await self.generate_ai_explanation(prompt_for_ai, attachment_obj)

            # Check if interrupted while AI was generating
            if self.is_interrupted:
                self.is_interrupted = False
                return

            # Parse AI output
            parsed_data = self.parse_ai_output(ai_response)

            # 3. Save updates to room (keep the lock in whiteboard)
            ai_msg = {"role": "assistant", "content": parsed_data["chat_response"]}
            self.room.chat_history.append(ai_msg)

            # Preserve the lock object in whiteboard_data and store the new blackboard summary
            current_wb = sanitize_whiteboard_data(self.room.whiteboard_data)
            current_lock = current_wb.get("lock")
            previous_summary = (current_wb.get("summary") or "").strip()
            new_summary = (parsed_data.get("whiteboard_summary") or "").strip()
            ai_wants_open = bool(parsed_data.get("open_whiteboard", False))

            if new_summary:
                board_summary = new_summary
            else:
                board_summary = previous_summary

            should_open = should_auto_open_whiteboard(
                prompt_for_ai, board_summary, previous_summary, ai_wants_open
            )

            persisted_wb = {**current_wb, "summary": board_summary, "lock": current_lock}
            self.room.whiteboard_data = persisted_wb
            await self.save_room()

            # 4. Generate audio if this is a voice interaction
            audio_data_uri = ""
            if data.get("is_voice"):
                audio_data_uri = await sync_to_async(generate_elevenlabs_audio)(parsed_data["chat_response"])

            # 5. Broadcast results to group
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "broadcast_message",
                    "message": {
                        "type": "chat_update",
                        "chat_history": self.room.chat_history,
                        "whiteboard_data": persisted_wb,
                        "open_whiteboard": should_open,
                        "is_generating": False,
                        "audio": audio_data_uri,
                        "is_voice": bool(data.get("is_voice")),
                    },
                },
            )
        except Exception as e:
            logger.exception("Error in AI explanation generation")
            err_msg = {
                "role": "assistant",
                "content": "Ocorreu um erro ao gerar a explicação. Houve um erro, tenta novamente.",
            }
            self.room.chat_history.append(err_msg)
            await self.save_room()

            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "broadcast_message",
                    "message": {
                        "type": "chat_update",
                        "chat_history": self.room.chat_history,
                        "whiteboard_data": sanitize_whiteboard_data(
                            self.room.whiteboard_data
                        ),
                        "is_generating": False,
                        "is_voice": bool(data.get("is_voice")),
                    },
                },
            )

    async def handle_chat_message_audio(self, data):
        """Receives base64-encoded audio, transcribes via Gemini, then delegates to handle_chat_message."""
        self.is_interrupted = False
        self.room = await self.get_room(self.room_uuid)
        if not self.room:
            return

        audio_base64 = data.get("audio_base64", "")
        raw_mime = data.get("mime_type", "audio/webm")
        if not audio_base64:
            return

        # Decode base64 audio bytes
        try:
            if "," in audio_base64:
                _, base64_str = audio_base64.split(",", 1)
            else:
                base64_str = audio_base64
            audio_bytes = base64.b64decode(base64_str)
        except Exception as e:
            logger.error(f"Failed to decode audio base64: {e}")
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "broadcast_message",
                    "message": {
                        "type": "chat_update",
                        "chat_history": self.room.chat_history,
                        "whiteboard_data": sanitize_whiteboard_data(
                            self.room.whiteboard_data
                        ),
                        "is_generating": False,
                        "is_voice": True,
                    },
                },
            )
            return

        # Normalise MIME type (MediaRecorder sometimes appends codecs info)
        mime_type = raw_mime.split(";")[0].strip()

        # Transcribe audio via Gemini
        try:
            client = get_genai_client()
            model_name = settings.AI.get("GENAI_MODEL_TEXT", "gemini-2.5-flash-lite")
            response = await sync_to_async(client.models.generate_content)(
                model=model_name,
                contents=[
                    "Transcreve apenas e exatamente o que foi dito neste áudio, mantendo o idioma original. "
                    "Não adiciones comentários, notas ou formatação extra. Se não conseguires perceber o áudio, devolve uma string vazia.",
                    types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                ],
            )
            transcript = (response.text or "").strip()
        except Exception as e:
            logger.exception("Failed to transcribe audio via Gemini")
            err_msg = {
                "role": "assistant",
                "content": "Não consegui transcrever o áudio. Houve um erro, tenta novamente.",
            }
            self.room.chat_history.append(err_msg)
            await self.save_room()
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "broadcast_message",
                    "message": {
                        "type": "chat_update",
                        "chat_history": self.room.chat_history,
                        "whiteboard_data": sanitize_whiteboard_data(
                            self.room.whiteboard_data
                        ),
                        "is_generating": False,
                        "is_voice": True,
                    },
                },
            )
            return

        if not transcript:
            # Empty transcript — release mute and do nothing
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "broadcast_message",
                    "message": {
                        "type": "voice_broadcast_ended",
                    },
                },
            )
            return

        # Delegate to the existing chat handler with the transcribed text
        data["message"] = transcript
        data["is_voice"] = True
        await self.handle_chat_message(data)

    async def handle_node_moved(self, data):
        """Synchronizes coordinate drag positions from the owner or the lock holder."""
        # Refresh room data to get latest lock state
        self.room = await self.get_room(self.room_uuid)
        if not self.room:
            return

        if not await self._is_solo_room():
            lock = self.room.whiteboard_data.get("lock")
            is_lock_holder = lock and lock.get("connection_id") == self.connection_id
            if not self.is_owner and not is_lock_holder:
                return

        node_id = data.get("node_id")
        x = data.get("x")
        y = data.get("y")

        if node_id is None or x is None or y is None:
            return

        # Update node coordinates in room memory and database
        nodes = self.room.whiteboard_data.get("nodes", [])
        for node in nodes:
            if node.get("id") == node_id:
                node["x"] = int(x)
                node["y"] = int(y)
                break

        self.room.whiteboard_data["nodes"] = nodes
        await self.save_room()

        # Broadcast the move to other participants
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_message",
                "message": {
                    "type": "node_position_update",
                    "node_id": node_id,
                    "x": x,
                    "y": y,
                },
            },
        )

    async def handle_voice_request(self, data):
        """Forwards a guest's audio request to the host."""
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_message",
                "message": {
                    "type": "voice_request",
                    "sender_connection_id": self.connection_id,
                    "name": data.get("name", "Visitante"),
                },
            },
        )

    async def handle_voice_response(self, data):
        """Forwards the host's approval/denial to the target guest."""
        if not self.is_owner:
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_message",
                "message": {
                    "type": "voice_response",
                    "target_connection_id": data.get("target_connection_id"),
                    "allowed": data.get("allowed", False),
                },
            },
        )

    async def handle_webrtc_signal(self, data):
        """Relays P2P WebRTC connection signals (offers, answers, ICE candidates)."""
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_message",
                "message": {
                    "type": "webrtc_signal",
                    "target_connection_id": data.get("target_connection_id"),
                    "sender_connection_id": self.connection_id,
                    "signal": data.get("signal"),
                },
            },
        )

    async def handle_audio_state(self, data):
        """Broadcast a user's mic/audio state change to the room and update presence."""
        is_mic_on = data.get("is_mic_on", False)
        is_listening = data.get("is_listening", True)

        await sync_to_async(room_presence.update_member)(
            self.room_uuid,
            self.connection_id,
            {"is_mic_on": is_mic_on, "is_listening": is_listening},
        )

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_message",
                "message": {
                    "type": "audio_state",
                    "connection_id": self.connection_id,
                    "is_mic_on": is_mic_on,
                    "is_listening": is_listening,
                },
            },
        )

    async def handle_ping(self, data):
        token_str = data.get("token")
        if token_str:
            user = await self.get_user(token_str)
            if not user.is_authenticated:
                await self.send(
                    text_data=json.dumps(
                        {
                            "type": "auth_error",
                            "message": "Sessão expirada. Renove o token.",
                        }
                    )
                )
                return
        await self.send(text_data=json.dumps({"type": "pong"}))

    async def handle_refresh_token(self, data):
        token_str = data.get("token", "").strip()
        if not token_str:
            await self.send(
                text_data=json.dumps(
                    {"type": "auth_error", "message": "Token em falta."}
                )
            )
            return

        user = await self.get_user(token_str)
        if not user.is_authenticated:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "auth_error",
                        "message": "Não foi possível renovar a sessão.",
                    }
                )
            )
            return

        self.user = user
        self.user_id = user.id
        self.user_name = f"{user.first_name} {user.last_name}".strip() or user.username
        avatar_url = None
        if hasattr(user, "avatar") and user.avatar:
            try:
                avatar_url = user.avatar.url
            except Exception:
                pass
        self.user_avatar = avatar_url

        await sync_to_async(room_presence.update_member)(
            self.room_uuid,
            self.connection_id,
            {
                "name": self.user_name,
                "avatar": self.user_avatar,
                "user_id": self.user_id,
            },
        )
        await self.send(text_data=json.dumps({"type": "token_refreshed"}))
        await self._broadcast_presence_sync()

    async def handle_request_presence(self):
        members = await sync_to_async(room_presence.list_members)(self.room_uuid)
        await self.send(
            text_data=json.dumps({"type": "presence_sync", "members": members})
        )

    async def _broadcast_presence_sync(self):
        """Broadcast the full presence roster to all members in the room."""
        await self._clear_lock_if_solo()
        members = await sync_to_async(room_presence.list_members)(self.room_uuid)
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_message",
                "message": {
                    "type": "presence_sync",
                    "members": members,
                },
            },
        )

    async def broadcast_message(self, event):
        """Send the broadcasted group event to this specific client connection."""
        await self.send(text_data=json.dumps(event["message"]))

    @sync_to_async
    def _check_pencil_request_rate_limit(self):
        import time

        from django.core.cache import cache

        key = f"pencil_request_{self.room_uuid}_{self.connection_id}"
        now = time.time()
        window = 30
        limit = 3

        timestamps = cache.get(key) or []
        timestamps = [t for t in timestamps if now - t < window]

        if len(timestamps) >= limit:
            wait_seconds = max(1, int(window - (now - timestamps[0])) + 1)
            return False, wait_seconds

        timestamps.append(now)
        cache.set(key, timestamps, window)
        return True, 0

    # Async Database Helpers
    @sync_to_async
    def get_user(self, token_str):
        if not token_str:
            from django.contrib.auth.models import AnonymousUser

            return AnonymousUser()
        try:
            token = AccessToken(token_str)
            user_id = token.payload.get("user_id")
            return User.objects.get(pk=user_id)
        except Exception:
            from django.contrib.auth.models import AnonymousUser

            return AnonymousUser()

    @sync_to_async
    def get_room(self, room_uuid):
        try:
            return ExplicadorRoom.objects.get(uuid=room_uuid)
        except Exception:
            return None

    @sync_to_async
    def save_room(self):
        if self.room:
            self.room.save()

    # AI Generation Pipeline
    def _format_course_context_block(self) -> str:
        if not self.room:
            return ""
        ctx = (self.room.whiteboard_data or {}).get("course_context")
        if not ctx or not isinstance(ctx, dict):
            return ""

        lines = ["Contexto do curso em que o aluno está a estudar:"]
        if ctx.get("course_title"):
            lines.append(f"- Curso: {ctx['course_title']}")
        if ctx.get("module_name"):
            lines.append(f"- Módulo: {ctx['module_name']}")
        if ctx.get("lesson_title"):
            lines.append(f"- Aula: {ctx['lesson_title']}")
        if ctx.get("lesson_description"):
            lines.append(f"- Descrição da aula: {ctx['lesson_description']}")
        if ctx.get("narration"):
            lines.append(f"- Conteúdo da aula (transcrição/resumo):\n{ctx['narration']}")

        if len(lines) <= 1:
            return ""
        lines.append(
            "Responde sempre em português, alinhado a este contexto quando relevante."
        )
        return "\n".join(lines) + "\n\n"

    async def generate_ai_explanation(self, message_content: str, attachment: dict | None = None) -> str:
        """Call get_text_chain() to prompt AI to explain and generate a beautifully structured classroom whiteboard summary."""
        context_block = self._format_course_context_block()
        if attachment:
            file_ref = f"O utilizador enviou um ficheiro ({attachment['name']})"
            if message_content:
                file_ref += f" e fez a seguinte pergunta sobre ele:\n\"{message_content}\""
            else:
                file_ref += " para analisar."
        else:
            file_ref = f"O utilizador deseja aprender sobre o seguinte assunto ou fez a seguinte pergunta:\n\"{message_content}\""
        prompt = f"""Você é um explicador didático especialista e professor particular premium.
{context_block}{file_ref}

Forneça sua resposta ESTRITAMENTE em formato JSON puro com três chaves:
- "chat_response": explicação em Markdown em português para o chat.
- "whiteboard_summary": resumo esquemático para o quadro (ou string vazia).
- "open_whiteboard": boolean — true APENAS se o quadro visual deve abrir automaticamente nesta resposta.

Use exatamente a seguinte estrutura JSON:
{{
  "chat_response": "Explicação didática em markdown.",
  "whiteboard_summary": "# Título\\n\\n- **Ponto 1**: síntese curta.",
  "open_whiteboard": true
}}

Regras para "open_whiteboard" (como ChatGPT/Claude decidem usar ferramentas):
1. true APENAS quando há conteúdo NOVO e útil para o quadro (fórmulas, passos, tópicos, diagramas) que não estava no quadro antes.
2. false para saudações, agradecimentos ("obrigado", "valeu"), despedidas, confirmações ("ok", "entendi", "perfeito"), ou quando a resposta no chat basta sozinha.
3. Se open_whiteboard for false, whiteboard_summary DEVE ser "" (string vazia) — não repita o quadro anterior.
4. Se open_whiteboard for true, whiteboard_summary DEVE ter conteúdo visual novo e diferente do que já foi mostrado.
5. Nunca uses open_whiteboard true só para repetir o mesmo resumo.

Regras para "whiteboard_summary" (quando open_whiteboard for true):
1. APENAS resumos esquemáticos, cálculos ou tópicos curtos — legível em poucos segundos.
2. Markdown limpo (títulos, listas, negrito, código para fórmulas).
3. Responda estritamente apenas com o JSON bruto, sem blocos ```json.
"""

        # We wrap in sync_to_async since provider calls might be blocking requests
        def run_chain():
            chain = get_text_chain()
            msg = {"role": "user", "content": prompt}
            if attachment:
                msg["attachment"] = {
                    "data": attachment["data"],
                    "mime_type": attachment["mime_type"]
                }
            return chain.handle(messages=[msg])

        return await sync_to_async(run_chain)()

    def parse_ai_output(self, text: str) -> dict:
        """Parse raw AI output into a dictionary, extracting JSON and adding robust fallbacks."""
        clean_text = text.strip()

        # Remove Markdown fences if AI wrapped it
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        elif clean_text.startswith("```"):
            clean_text = clean_text[3:]

        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]

        clean_text = clean_text.strip()

        # Helper to decode a JSON string value by repairing its backslashes
        def decode_json_string(raw_str: str) -> str:
            # Match a backslash not preceded by another backslash, and not followed by valid JSON escapes.
            # We only preserve \", \\, \/, \n, \r, \b, \uXXXX.
            # \f and \t are doubled to \\f and \\t because they usually mean LaTeX \frac and \text.
            pattern = re.compile(r"(?<!\\)\\(?![\"\\/nrb]|u[0-9a-fA-F]{4})")
            repaired = pattern.sub(r"\\\\", raw_str)
            try:
                return json.loads(f"\"{repaired}\"")
            except Exception:
                # Fallback: manual replacements
                return raw_str.replace("\\\"", "\"").replace("\\n", "\n").replace("\\\\", "\\")

        # 1. Try parsing the whole clean_text directly with json.loads
        try:
            parsed = json.loads(clean_text)
            if isinstance(parsed, dict) and "chat_response" in parsed:
                parsed.setdefault("whiteboard_summary", "")
                parsed.setdefault("open_whiteboard", False)
                if not str(parsed.get("whiteboard_summary", "")).strip():
                    parsed["open_whiteboard"] = False
                return parsed
        except Exception:
            pass

        # 2. Try to extract JSON object between first { and last } and repair it
        first_brace = clean_text.find("{")
        last_brace = clean_text.rfind("}")
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            candidate = clean_text[first_brace:last_brace+1]
            pattern = re.compile(r"(?<!\\)\\(?![\"\\/nrb]|u[0-9a-fA-F]{4})")
            repaired = pattern.sub(r"\\\\", candidate)
            try:
                parsed = json.loads(repaired)
                if isinstance(parsed, dict) and "chat_response" in parsed:
                    parsed.setdefault("whiteboard_summary", "")
                    parsed.setdefault("open_whiteboard", False)
                    if not str(parsed.get("whiteboard_summary", "")).strip():
                        parsed["open_whiteboard"] = False
                    return parsed
            except Exception:
                pass

        # 3. Fall back to Regex extraction from the text
        chat_resp = ""
        whiteboard_sum = ""
        open_wb = False

        chat_match = re.search(r"\"chat_response\"\s*:\s*\"([^\"\\]*(?:\\.[^\"\\]*)*)\"", clean_text, re.DOTALL)
        if chat_match:
            chat_resp = decode_json_string(chat_match.group(1))
        else:
            chat_resp = text

        wb_match = re.search(r"\"whiteboard_summary\"\s*:\s*\"([^\"\\]*(?:\\.[^\"\\]*)*)\"", clean_text, re.DOTALL)
        if wb_match:
            whiteboard_sum = decode_json_string(wb_match.group(1))

        open_match = re.search(r"\"open_whiteboard\"\s*:\s*(true|false)", clean_text, re.IGNORECASE)
        if open_match:
            open_wb = open_match.group(1).lower() == "true"

        if not whiteboard_sum.strip():
            open_wb = False

        return {
            "chat_response": chat_resp,
            "whiteboard_summary": whiteboard_sum,
            "open_whiteboard": open_wb,
        }
