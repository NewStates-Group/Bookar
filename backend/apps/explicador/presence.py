"""Presença das salas do explicador em cache (Redis) — partilhada entre workers."""

from django.core.cache import cache

PRESENCE_TTL = 60 * 60 * 6  # 6 horas


def _cache_key(room_uuid: str) -> str:
    return f"explicador:presence:{room_uuid}"


def get_all(room_uuid: str) -> dict:
    return dict(cache.get(_cache_key(room_uuid)) or {})


def list_members(room_uuid: str) -> list:
    return list(get_all(room_uuid).values())


def _save(room_uuid: str, members: dict) -> None:
    if members:
        cache.set(_cache_key(room_uuid), members, PRESENCE_TTL)
    else:
        cache.delete(_cache_key(room_uuid))


def add_member(room_uuid: str, connection_id: str, member: dict, user_id=None) -> list:
    members = get_all(room_uuid)
    if user_id is not None:
        stale_ids = [
            cid for cid, info in members.items() if info.get("user_id") == user_id
        ]
        for cid in stale_ids:
            members.pop(cid, None)
    members[connection_id] = member
    _save(room_uuid, members)
    return list(members.values())


def remove_member(room_uuid: str, connection_id: str) -> list:
    members = get_all(room_uuid)
    members.pop(connection_id, None)
    _save(room_uuid, members)
    return list(members.values())


def update_member(room_uuid: str, connection_id: str, updates: dict) -> list:
    members = get_all(room_uuid)
    if connection_id in members:
        members[connection_id].update(updates)
        _save(room_uuid, members)
    return list(members.values())
