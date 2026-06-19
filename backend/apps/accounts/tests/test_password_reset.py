from django.test import TransactionTestCase, override_settings
from ninja_extra.testing import TestAsyncClient

from core.api import api
from utils.tests import acreate_user


def _client():
    return TestAsyncClient(api)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class TestPasswordReset(TransactionTestCase):
    async def test_request_reset(self):
        user = await acreate_user()
        resp = await _client().post(
            "/auth/password-reset/request", json={"email": user.email}
        )
        self.assertEqual(resp.status_code, 200)

    async def test_confirm_reset_invalid_token(self):
        resp = await _client().post(
            "/auth/password-reset/confirm",
            json={"token": "bad_token", "new_password": "NewStrongPass1234"},
        )
        self.assertEqual(resp.status_code, 400)
