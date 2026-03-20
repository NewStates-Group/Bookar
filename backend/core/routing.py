from django.urls import path
from .consumers import UserUpdateConsumer

websocket_urlpatterns = [
    path("ws/updates/", UserUpdateConsumer.as_asgi()),
]
