from django.test import TransactionTestCase
from ninja_extra.testing import TestAsyncClient

from core.api import api
from utils.tests import acreate_user


def _client():
    return TestAsyncClient(api)


class TestEmailVerification(TransactionTestCase):
    async def test_send_verification(self):
        resp = await _client().post(
            "/auth/send-verification", json={"email": "verify@example.com"}
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("Código", data["message"])

    async def test_check_email_exists(self):
        await acreate_user(email="exists@example.com")
        resp = await _client().post(
            "/auth/check-email", json={"email": "exists@example.com"}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["exists"])

    async def test_check_email_not_exists(self):
        resp = await _client().post(
            "/auth/check-email", json={"email": "new@example.com"}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json()["exists"])
