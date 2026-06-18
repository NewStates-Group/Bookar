import logging

from .base import BasePaymentProvider

logger = logging.getLogger(__name__)


providers: dict[str, type[BasePaymentProvider]] = {}


def register_provider(provider_cls):
    providers[provider_cls.gateway] = provider_cls


def get_provider(gateway: str) -> BasePaymentProvider:
    cls = providers.get(gateway)
    if not cls:
        raise ValueError(f"Provider '{gateway}' not found. Available: {list(providers.keys())}")
    return cls()


# Import and register providers
from .manual import ManualPaymentProvider
from .stripe import StripePaymentProvider

register_provider(ManualPaymentProvider)
register_provider(StripePaymentProvider)

__all__ = [
    "BasePaymentProvider",
    "StripePaymentProvider",
    "ManualPaymentProvider",
    "get_provider",
    "register_provider",
]
