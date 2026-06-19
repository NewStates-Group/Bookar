import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

django_asgi_app = get_asgi_application()

from apps.accounts.consumers import UserUpdateConsumer  # NOQA
from apps.explicador.consumers import ExplicadorConsumer  # NOQA
from channels.routing import ProtocolTypeRouter, URLRouter  # NOQA
from django.urls import path  # NOQA

from .middlewares import AuthMiddleware  # NOQA

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AuthMiddleware(
            URLRouter(
                [
                    path("ws/updates/", UserUpdateConsumer.as_asgi()),
                    path(
                        "ws/explicador/<str:room_uuid>/", ExplicadorConsumer.as_asgi()
                    ),
                ]
            )
        ),
    }
)
