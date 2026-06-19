import logging

logger = logging.getLogger(__name__)


class BasePaymentProvider:
    gateway = ""

    def create_checkout_session(
        self, plan, user, success_url: str, cancel_url: str
    ) -> dict:
        raise NotImplementedError

    def retrieve_checkout_session(self, session_id: str) -> dict | None:
        raise NotImplementedError

    def cancel_subscription(self, subscription) -> bool:
        raise NotImplementedError

    def handle_webhook(self, request):
        raise NotImplementedError

    def get_subscription_status(self, subscription) -> str:
        raise NotImplementedError

    def sync_subscription(self, subscription) -> object:
        raise NotImplementedError
