import logging

import httpx
from asgiref.sync import sync_to_async
from django.conf import settings

from .models import Feedback

logger = logging.getLogger(__name__)


async def _verify_turnstile(token: str) -> bool:
    if settings.DEBUG and token == "XXXX.DUMMY.TOKEN.XXXX":
        return True

    url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    data = {
        "secret": settings.CLOUDFLARE_TURNSTILE_SECRET_KEY,
        "response": token,
    }
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, data=data)
            if res.is_success:
                return res.json().get("success", False)
    except Exception as e:
        logger.error(f"Turnstile verification error: {e}")
    return False


class FeedbackService:
    async def submit_feedback(self, name: str, email: str, message: str, token: str):
        if not await _verify_turnstile(token):
            raise ValueError("Falha na verificação de segurança. Tente novamente.")

        await sync_to_async(Feedback.objects.create)(
            name=name, email=email, message=message
        )
        return {"status": "success", "message": "Feedback enviado com sucesso!"}
