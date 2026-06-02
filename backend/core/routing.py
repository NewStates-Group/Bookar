from django.urls import path
from explicador.consumers import ExplicadorConsumer

from .consumers import UserUpdateConsumer

websocket_urlpatterns = [
    path("ws/updates/", UserUpdateConsumer.as_asgi()),
    path("ws/explicador/<str:room_uuid>/", ExplicadorConsumer.as_asgi()),
]
