from .base import BasePaymentProvider
from .stripe import StripePaymentProvider
from .manual import ManualPaymentProvider

_providers: dict[str, type[BasePaymentProvider]] = {}


def register_provider(provider_cls: type[BasePaymentProvider]):
    _providers[provider_cls.gateway] = provider_cls


def get_provider(gateway: str) -> BasePaymentProvider:
    cls = _providers.get(gateway)
    if not cls:
        raise ValueError(f"Unknown payment gateway: {gateway}")
    return cls()


register_provider(StripePaymentProvider)
register_provider(ManualPaymentProvider)

__all__ = ["BasePaymentProvider", "StripePaymentProvider", "ManualPaymentProvider", "register_provider", "get_provider"]
