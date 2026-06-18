import asyncio
import json
from typing import List, Optional

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.http import StreamingHttpResponse
from injector import inject
from ninja_extra import api_controller, route
from ninja_jwt.authentication import JWTAuth
from ninja_jwt.tokens import AccessToken
from ninja import Query

from apps.courses.providers import AllProvidersFailed, get_text_chain
from .schemas import (
    ExplicadorAskIn,
    ExplicadorRoomCreateIn,
    ExplicadorRoomDetailOut,
    ExplicadorRoomOut,
)
from .services import ExplicadorService

User = get_user_model()


@api_controller("explicador", tags=["Explicador"])
class ExplicadorController:
    @inject
    def __init__(self, explicador_service: ExplicadorService):
        self.explicador_service = explicador_service

    @route.get("", response=List[ExplicadorRoomOut], auth=JWTAuth())
    def list_rooms(self, request, q: Optional[str] = Query(None)):
        """List explanation rooms owned by the logged-in user. Optionally filter by title."""
        return self.explicador_service.list_rooms(request.user, q=q or "")

    @route.post("", response=ExplicadorRoomOut, auth=JWTAuth())
    def create_room(self, request, data: ExplicadorRoomCreateIn):
        """Create a new explanation room."""
        course_context = (
            data.course_context.model_dump(exclude_none=True)
            if data.course_context
            else None
        )
        return self.explicador_service.create_room(
            request.user, data.title, course_context=course_context
        )

    @route.post("ask", auth=JWTAuth())
    def ask_question(self, request, payload: ExplicadorAskIn):
        """Stream an AI answer via SSE — no room created."""

        async def event_stream():
            ctx = payload.context
            system_content = (
                "És o Explicador IA da plataforma Bookar, um assistente de estudos "
                "que ajuda alunos a compreender matérias académicas. Responde em português "
                "de forma clara, didática e concisa."
            )
            if ctx:
                extra = ""
                if ctx.course_title:
                    extra += f" O aluno está a estudar o curso: {ctx.course_title}."
                if ctx.module_name:
                    extra += f" Módulo: {ctx.module_name}."
                if ctx.lesson_title:
                    extra += f" Aula: {ctx.lesson_title}."
                if ctx.lesson_description:
                    extra += f" Descrição: {ctx.lesson_description}"
                if extra:
                    system_content += extra

            messages = [{"role": "system", "content": system_content}]
            if payload.history:
                for msg in payload.history:
                    if isinstance(msg, dict) and "role" in msg and "content" in msg:
                        messages.append(
                            {"role": msg["role"], "content": msg["content"]}
                        )
            messages.append({"role": "user", "content": payload.message})

            chain = get_text_chain()
            queue: asyncio.Queue[str | None] = asyncio.Queue()

            async def producer():
                loop = asyncio.get_event_loop()
                try:
                    def sync_stream():
                        for token in chain.stream(messages=messages):
                            if token:
                                yield token

                    _SENTINEL = object()
                    it = iter(sync_stream())
                    while True:
                        result = await loop.run_in_executor(
                            None, lambda: next(it, _SENTINEL)
                        )
                        if result is _SENTINEL:
                            break
                        await queue.put(result)
                except AllProvidersFailed as e:
                    await queue.put(f"__error__:{e}")
                finally:
                    await queue.put(None)

            task = asyncio.ensure_future(producer())

            while True:
                item = await queue.get()
                if item is None:
                    break
                if isinstance(item, str) and item.startswith("__error__:"):
                    yield f"data: {json.dumps({'error': item[len('__error__:'):]})}\n\n"
                    break
                yield f"data: {json.dumps({'token': item})}\n\n"

            yield "data: [DONE]\n\n"
            task.cancel()

        response = StreamingHttpResponse(
            event_stream(),
            content_type="text/event-stream",
        )

        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"

        return response

    @route.get("{room_uuid}", response=ExplicadorRoomDetailOut)
    def get_room(self, request, room_uuid: str):
        """
        Get details of an explanation room (public/guest endpoint).
        Resolves the user from JWT header manually if present.
        """
        user = AnonymousUser()
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token_str = auth_header.split(" ")[1]
            try:
                token = AccessToken(token_str)
                user_id = token.payload.get("user_id")
                user = User.objects.get(pk=user_id)
            except Exception:
                pass

        return self.explicador_service.get_room(room_uuid, user)

    @route.delete("{room_uuid}", auth=JWTAuth())
    def delete_room(self, request, room_uuid: str):
        """Delete an explanation room (restricted to owner)."""
        return self.explicador_service.delete_room(room_uuid, request.user)
