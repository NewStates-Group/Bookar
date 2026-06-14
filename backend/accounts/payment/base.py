from abc import ABC, abstractmethod


class BasePaymentProvider(ABC):
    gateway: str = ""

    @abstractmethod
    def create_checkout_session(
        self, plan, user, success_url: str, cancel_url: str
    ) -> dict:
        """
        Create a checkout session for the given plan and user.
        Returns dict with at least {'url': 'https://...', 'session_id': '...'}.
        """
        ...

    @abstractmethod
    def cancel_subscription(self, subscription) -> bool:
        """Cancel an active subscription at the gateway."""
        ...

    @abstractmethod
    def handle_webhook(self, request):
        """
        Process an incoming webhook from the gateway.
        Returns the event type string or None if unhandled.
        """
        ...

    @abstractmethod
    def get_subscription_status(self, subscription) -> str:
        """Query the current status of a subscription from the gateway."""
        ...

    @abstractmethod
    def sync_subscription(self, subscription) -> object:
        """
        Sync subscription data (dates, status) from the gateway to the local model.
        Returns the updated UserSubscription instance.
        """
        ...
