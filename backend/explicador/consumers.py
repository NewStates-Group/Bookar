import json
import logging
import re
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
from ninja_jwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from asgiref.sync import sync_to_async

from courses.providers import get_text_chain
from .models import ExplicadorRoom
from . import presence as room_presence

logger = logging.getLogger(__name__)
User = get_user_model()

EXPLICADOR_MENTION = "@explicador"


def message_mentions_explicador(text: str) -> bool:
    return EXPLICADOR_MENTION in text.lower()


def strip_explicador_mention(text: str) -> str:
    cleaned = re.sub(r"@explicador\s*", "", text, flags=re.IGNORECASE).strip()
    return cleaned



class ExplicadorConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # 1. Extract parameters
        self.room_uuid = self.scope["url_route"]["kwargs"]["room_uuid"]
        
        # Authenticate using token from query string
        query_string = self.scope.get("query_string", b"").decode("utf-8")
        params = dict(x.split("=") for x in query_string.split("&") if "=" in x)
        token_str = params.get("token")

        self.user = await self.get_user(token_str)
        self.room = await self.get_room(self.room_uuid)

        if not self.room:
            logger.warning(f"Explicador connection refused: room {self.room_uuid} not found")
            await self.close()
            return

        self.connection_id = str(uuid.uuid4())
        self.is_owner = self.user.is_authenticated and (self.room.owner_id == self.user.id)
        self.group_name = f"explicador_{self.room_uuid}"

        # Resolve user name and avatar
        self.user_name = (
            f"{self.user.first_name} {self.user.last_name}".strip() or self.user.username 
            if self.user.is_authenticated 
            else "Visitante"
        )
        avatar_url = None
        if self.user.is_authenticated and hasattr(self.user, 'avatar') and self.user.avatar:
            try:
                avatar_url = self.user.avatar.url
            except Exception:
                pass
        self.user_avatar = avatar_url
        self.user_id = self.user.id if self.user.is_authenticated else None

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

        # 2. Join room group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # 3. Send welcome payload to newly connected user (roster completo da cache)
        await self.send(
            text_data=json.dumps(
                {
                    "type": "welcome",
                    "connection_id": self.connection_id,
                    "is_owner": self.is_owner,
                    "whiteboard_data": self.room.whiteboard_data,
                    "chat_history": self.room.chat_history,
                    "members": members,
                }
            )
        )

        # Roster completo para todos (fonte única de verdade no cliente)
        await self._broadcast_presence_sync()

    async def disconnect(self, close_code):
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
                    # Broadcast the lock release immediately
                    await self.channel_layer.group_send(
                        self.group_name,
                        {
                            "type": "broadcast_message",
                            "message": {
                                "type": "chat_update",
                                "chat_history": self.room.chat_history,
                                "whiteboard_data": self.room.whiteboard_data,
                            },
                        },
                    )

            await self._broadcast_presence_sync()

            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except Exception:
            logger.error("Failed to parse WebSocket JSON payload")
            return

        action_type = data.get("type")

        # Route actions
        if action_type == "chat_message":
            await self.handle_chat_message(data)
        elif action_type == "node_moved":
            await self.handle_node_moved(data)
        elif action_type == "voice_request":
            await self.handle_voice_request(data)
        elif action_type == "voice_response":
            await self.handle_voice_response(data)
        elif action_type == "webrtc_signal":
            await self.handle_webrtc_signal(data)
        elif action_type == "grab_lock":
            await self.handle_grab_lock(data)
        elif action_type == "release_lock":
            await self.handle_release_lock(data)
        elif action_type == "audio_state":
            await self.handle_audio_state(data)
        elif action_type == "ping":
            await self.handle_ping(data)
        elif action_type == "refresh_token":
            await self.handle_refresh_token(data)
        elif action_type == "request_presence":
            await self.handle_request_presence()

    async def handle_grab_lock(self, data):
        """Allows a user to grab the chalk (lock) to write on the board."""
        # Refresh room data
        self.room = await self.get_room(self.room_uuid)
        if not self.room:
            return

        lock = self.room.whiteboard_data.get("lock")
        if not lock:
            user_name = (
                f"{self.user.first_name} {self.user.last_name}".strip() or self.user.username 
                if self.user.is_authenticated 
                else "Visitante"
            )
            self.room.whiteboard_data["lock"] = {
                "connection_id": self.connection_id,
                "name": user_name,
            }
            await self.save_room()

            # Broadcast new lock state to the room
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "broadcast_message",
                    "message": {
                        "type": "chat_update",
                        "chat_history": self.room.chat_history,
                        "whiteboard_data": self.room.whiteboard_data,
                    },
                },
            )

    async def handle_release_lock(self, data):
        """Allows the current lock holder to release the chalk."""
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
                        "whiteboard_data": self.room.whiteboard_data,
                    },
                },
            )

    async def handle_chat_message(self, data):
        """Processes a chat message from the lock holder and queries AI."""
        # Refresh room data to get latest lock state
        self.room = await self.get_room(self.room_uuid)
        if not self.room:
            return

        lock = self.room.whiteboard_data.get("lock")
        if not lock or lock.get("connection_id") != self.connection_id:
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "message": "Você precisa pegar o Giz primeiro para poder falar com a IA."}
                )
            )
            return

        message_content = data.get("message", "").strip()
        if not message_content:
            return

        mentions_tutor = message_mentions_explicador(message_content)
        prompt_for_ai = strip_explicador_mention(message_content) if mentions_tutor else ""

        # 1. Update chat history with user message (always visible in the room)
        user_name = lock.get("name", "Usuário")
        user_msg = {"role": "user", "content": f"**[{user_name}]**: {message_content}"}
        self.room.chat_history.append(user_msg)
        await self.save_room()

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_message",
                "message": {
                    "type": "chat_update",
                    "chat_history": self.room.chat_history,
                    "whiteboard_data": self.room.whiteboard_data,
                    "is_generating": mentions_tutor,
                },
            },
        )

        if not mentions_tutor:
            return

        if not prompt_for_ai:
            prompt_for_ai = "Olá, estou disponível para ajudar. Em que posso esclarecer as tuas dúvidas?"

        # 2. Call AI only when @explicador is mentioned
        try:
            ai_response = await self.generate_ai_explanation(prompt_for_ai)
            
            # Parse AI output
            parsed_data = self.parse_ai_output(ai_response)
            
            # 3. Save updates to room (keep the lock in whiteboard)
            ai_msg = {"role": "assistant", "content": parsed_data["chat_response"]}
            self.room.chat_history.append(ai_msg)
            
            # Preserve the lock object in whiteboard_data and store the new blackboard summary
            current_lock = self.room.whiteboard_data.get("lock")
            new_summary = (parsed_data.get("whiteboard_summary") or "").strip()
            open_whiteboard = bool(parsed_data.get("open_whiteboard", False))

            if new_summary:
                board_summary = new_summary
            else:
                board_summary = self.room.whiteboard_data.get("summary", "")
                open_whiteboard = False

            # Só abre o quadro quando a IA decidir que ajuda E houver conteúdo visual novo
            open_whiteboard = open_whiteboard and bool(new_summary)

            self.room.whiteboard_data = {
                "summary": board_summary,
                "lock": current_lock,
                "open_whiteboard": open_whiteboard,
            }
            
            await self.save_room()

            # 4. Broadcast results to group
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "broadcast_message",
                    "message": {
                        "type": "chat_update",
                        "chat_history": self.room.chat_history,
                        "whiteboard_data": self.room.whiteboard_data,
                        "is_generating": False,
                    },
                },
            )
        except Exception as e:
            logger.exception("Error in AI explanation generation")
            # Append error in history so user knows what went wrong
            err_msg = {"role": "assistant", "content": f"Ocorreu um erro ao gerar a explicação: {str(e)}"}
            self.room.chat_history.append(err_msg)
            await self.save_room()
            
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "broadcast_message",
                    "message": {
                        "type": "chat_update",
                        "chat_history": self.room.chat_history,
                        "whiteboard_data": self.room.whiteboard_data,
                        "is_generating": False,
                    },
                },
            )

    async def handle_node_moved(self, data):
        """Synchronizes coordinate drag positions from the owner or the lock holder."""
        # Refresh room data to get latest lock state
        self.room = await self.get_room(self.room_uuid)
        if not self.room:
            return

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
        self.user_name = (
            f"{user.first_name} {user.last_name}".strip() or user.username
        )
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
    async def generate_ai_explanation(self, message_content: str) -> str:
        """Call get_text_chain() to prompt AI to explain and generate a beautifully structured classroom whiteboard summary."""
        prompt = f"""Você é um explicador didático especialista e professor particular premium.
O utilizador deseja aprender sobre o seguinte assunto ou fez a seguinte pergunta:
"{message_content}"

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
1. true quando conceitos, fórmulas, passos, comparações ou estrutura visual ajudam MUITO a aprender (ex.: demonstração matemática, resumo de tópicos, diagrama em tópicos).
2. false para saudações, agradecimentos, despedidas, confirmações curtas ("ok", "entendi"), perguntas de opinião sem conteúdo técnico, ou quando a resposta no chat basta sozinha.
3. Se open_whiteboard for false, whiteboard_summary DEVE ser "".
4. Se open_whiteboard for true, whiteboard_summary DEVE ter conteúdo útil e minimalista.

Regras para "whiteboard_summary" (quando open_whiteboard for true):
1. APENAS resumos esquemáticos, cálculos ou tópicos curtos — legível em poucos segundos.
2. Markdown limpo (títulos, listas, negrito, código para fórmulas).
3. Responda estritamente apenas com o JSON bruto, sem blocos ```json.
"""
        
        # We wrap in sync_to_async since provider calls might be blocking requests
        def run_chain():
            chain = get_text_chain()
            return chain.handle(messages=[{"role": "user", "content": prompt}])

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

        try:
            parsed = json.loads(clean_text)
            if "chat_response" in parsed:
                parsed.setdefault("whiteboard_summary", "")
                parsed.setdefault("open_whiteboard", False)
                if not str(parsed.get("whiteboard_summary", "")).strip():
                    parsed["open_whiteboard"] = False
                return parsed
        except Exception:
            logger.warning("AI response was not valid JSON, applying raw fallback parsing")

        return {
            "chat_response": text,
            "whiteboard_summary": "",
            "open_whiteboard": False,
        }
