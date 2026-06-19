from django.test import TransactionTestCase
from ninja_extra.testing import TestAsyncClient

from core.api import api


def _client():
    return TestAsyncClient(api)


class TestCheckEmail(TransactionTestCase):
    async def test_valid_email_format(self):
        resp = await _client().post(
            "/auth/check-email", json={"email": "valid@example.com"}
        )
        self.assertEqual(resp.status_code, 200)

    async def test_invalid_email_format(self):
        resp = await _client().post(
            "/auth/check-email", json={"email": "not-an-email"}
        )
        self.assertEqual(resp.status_code, 422)
