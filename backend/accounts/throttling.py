from typing import Optional

from django.http import HttpRequest
from ninja_extra.throttling import SimpleRateThrottle


class AnonRateThrottle(SimpleRateThrottle):
    scope = "anon"

    def get_cache_key(self, request: HttpRequest) -> Optional[str]:
        if getattr(request, "user", None) and request.user.is_authenticated:
            return None

        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


class DynamicRateThrottle(SimpleRateThrottle):
    def __init__(self, rate: Optional[str] = None, scope: Optional[str] = None) -> None:
        self.scope = scope
        super().__init__(rate)

    def get_cache_key(self, request: HttpRequest) -> Optional[str]:
        if getattr(request, "user", None) and request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)

        return self.cache_format % {"scope": self.scope, "ident": ident}
