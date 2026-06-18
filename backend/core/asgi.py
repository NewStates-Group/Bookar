import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

django_asgi_app = get_asgi_application()

from django.urls import path  # NOQA
from apps.explicador.consumers import ExplicadorConsumer  # NOQA
from apps.accounts.consumers import AdminUpdateConsumer, UserUpdateConsumer  # NOQA


application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AuthMiddlewareStack(
            URLRouter(
                [
                    path("ws/updates/", UserUpdateConsumer.as_asgi()),
                    path("ws/admin/updates/", AdminUpdateConsumer.as_asgi()),
                    path(
                        "ws/explicador/<str:room_uuid>/", ExplicadorConsumer.as_asgi()
                    ),
                ]
            )
        ),
    }
)
