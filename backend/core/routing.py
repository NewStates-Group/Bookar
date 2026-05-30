from django.urls import path
from .consumers import UserUpdateConsumer
from explicador.consumers import ExplicadorConsumer

websocket_urlpatterns = [
    path("ws/updates/", UserUpdateConsumer.as_asgi()),
    path("ws/explicador/<str:room_uuid>/", ExplicadorConsumer.as_asgi()),
]
