import json
import logging
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
from ninja_jwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from asgiref.sync import sync_to_async

from courses.providers import get_text_chain
from .models import ExplicadorRoom

logger = logging.getLogger(__name__)
User = get_user_model()

# Server-side presence tracking: { room_uuid: { connection_id: { name, avatar, user_id, is_owner, is_mic_on, is_listening } } }
_room_members = {}



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

        # Add to room members (evict stale connections from same user on reload)
        if self.room_uuid not in _room_members:
            _room_members[self.room_uuid] = {}
        
        if self.user_id is not None:
            stale_ids = [
                cid for cid, info in _room_members[self.room_uuid].items()
                if info.get("user_id") == self.user_id
            ]
            for cid in stale_ids:
                _room_members[self.room_uuid].pop(cid, None)
                logger.info(f"Evicted stale connection {cid} for user {self.user_id} in room {self.room_uuid}")

        _room_members[self.room_uuid][self.connection_id] = {
            "connection_id": self.connection_id,
            "name": self.user_name,
            "avatar": self.user_avatar,
            "user_id": self.user_id,
            "is_owner": self.is_owner,
            "is_mic_on": False,
            "is_listening": True,
        }

        # 2. Join room group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # 3. Send welcome payload to newly connected user
        members = list(_room_members.get(self.room_uuid, {}).values())
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

        # 4. Broadcast join event to all other members
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_message",
                "message": {
                    "type": "user_joined",
                    "connection_id": self.connection_id,
                    "name": self.user_name,
                    "is_owner": self.is_owner,
                    "avatar": self.user_avatar,
                    "user_id": self.user_id,
                },
            },
        )

        # Broadcast the full current membership to sync all frontends
        await self._broadcast_presence_sync()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            # Remove from presence tracking
            if self.room_uuid in _room_members:
                _room_members[self.room_uuid].pop(self.connection_id, None)
                if not _room_members[self.room_uuid]:
                    del _room_members[self.room_uuid]

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

            # Broadcast leave event
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "broadcast_message",
                    "message": {
                        "type": "user_left",
                        "connection_id": self.connection_id,
                        "name": getattr(self, "user_name", "Visitante"),
                    },
                },
            )

            # Broadcast the updated presence roster
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

        # 1. Update chat history with user message
        user_name = lock.get("name", "Usuário")
        user_msg = {"role": "user", "content": f"**[{user_name}]**: {message_content}"}
        self.room.chat_history.append(user_msg)
        await self.save_room()

        # Broadcast the new user message immediately
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_message",
                "message": {
                    "type": "chat_update",
                    "chat_history": self.room.chat_history,
                    "whiteboard_data": self.room.whiteboard_data,
                    "is_generating": True,
                },
            },
        )

        # 2. Call AI to explain the subject and generate the whiteboard JSON structure
        try:
            ai_response = await self.generate_ai_explanation(message_content)
            
            # Parse AI output
            parsed_data = self.parse_ai_output(ai_response)
            
            # 3. Save updates to room (keep the lock in whiteboard)
            ai_msg = {"role": "assistant", "content": parsed_data["chat_response"]}
            self.room.chat_history.append(ai_msg)
            
            # Preserve the lock object in whiteboard_data and store the new blackboard summary
            current_lock = self.room.whiteboard_data.get("lock")
            new_summary = parsed_data.get("whiteboard_summary", "")
            
            # If the new summary is empty (AI evaluated no need to write/update), preserve the previous summary
            if not new_summary.strip():
                new_summary = self.room.whiteboard_data.get("summary", "")
                
            self.room.whiteboard_data = {
                "summary": new_summary,
                "lock": current_lock
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

        # Update in-memory presence details
        if self.room_uuid in _room_members and self.connection_id in _room_members[self.room_uuid]:
            _room_members[self.room_uuid][self.connection_id]["is_mic_on"] = is_mic_on
            _room_members[self.room_uuid][self.connection_id]["is_listening"] = is_listening

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

    async def _broadcast_presence_sync(self):
        """Broadcast the full presence roster to all members in the room."""
        members = list(_room_members.get(self.room_uuid, {}).values())
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

Forneça sua resposta ESTRITAMENTE em formato JSON puro, contendo uma chave "chat_response" (uma explicação textual detalhada, estruturada e amigável em Markdown em português) e uma chave "whiteboard_summary" (um resumo esquemático, cálculos ou tópicos estruturados em Markdown para serem exibidos no quadro branco).

Use exatamente a seguinte estrutura JSON:
{{
  "chat_response": "Uma explicação em markdown detalhada e didática em português para a conversa do chat.",
  "whiteboard_summary": "# Título do Assunto\\n\\n- **Tópico 1**: Frase curtíssima.\\n- **Tópico 2**: Frase curtíssima.\\n\\n## 🧮 Cálculo / Regra\\n- `Fórmula ou Cálculo numérico`"
}}

Regras fundamentais de escrita no quadro ("whiteboard_summary"):
1. AVALIAÇÃO DE NECESSIDADE: Avalie criteriosamente se a mensagem do utilizador realmente exige uma explicação técnica ou resumo de conteúdo no quadro. Se for uma saudação (ex: "Olá", "bom dia"), agradecimento ("obrigado"), despedida ("tchau") ou conversa informal que não traga novos conceitos didáticos, a chave "whiteboard_summary" deve retornar obrigatoriamente uma string vazia ("").
2. CONTEÚDO ULTRA-MINIMALISTA: O quadro deve conter APENAS resumos esquemáticos, cálculos ou tópicos extremamente curtos. Evite parágrafos longos, descrições redundantes ou introduções verbosas. O utilizador deve poder bater o olho no quadro e ler a síntese em poucos segundos.
3. Use apenas Markdown limpo (títulos, listas, negrito ou blocos de código para fórmulas).
4. Responda estritamente apenas com o JSON bruto. Não adicione blocos markdown ou comentários adicionais fora do JSON.
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
            # Ensure required keys exist
            if "chat_response" in parsed and "whiteboard_summary" in parsed:
                return parsed
        except Exception:
            logger.warning("AI response was not valid JSON, applying raw fallback parsing")

        # Fallback parsing in case the output fails or is just normal text
        return {
            "chat_response": text,
            "whiteboard_summary": f"# Explicação do Assunto\n\n## 💡 Introdução\n- Iniciei a síntese visual do assunto.\n\n## 📝 Detalhes\n- Veja o chat ao lado para ler a explicação detalhada do explicador!"
        }
