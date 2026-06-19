from unittest.mock import AsyncMock, patch

from django.test import TransactionTestCase, override_settings
from ninja_extra.testing import TestAsyncClient

from core.api import api
from utils.tests import acreate_user


def _client():
    return TestAsyncClient(api)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class TestLogin(TransactionTestCase):
    async def test_login_success(self):
        user = await acreate_user(email="login@example.com", password="StrongPass1234")
        with patch(
            "apps.accounts.services.AuthService.averify_turnstile",
            AsyncMock(return_value=True),
        ):
            resp = await _client().post(
                "/auth/pair",
                json={
                    "email": "login@example.com",
                    "password": "StrongPass1234",
                    "token": "mock_turnstile",
                },
            )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("access", data)
        self.assertIn("refresh", data)

    async def test_login_wrong_password(self):
        await acreate_user(email="wrongpass@example.com", password="StrongPass1234")
        with patch(
            "apps.accounts.services.AuthService.averify_turnstile",
            AsyncMock(return_value=True),
        ):
            resp = await _client().post(
                "/auth/pair",
                json={
                    "email": "wrongpass@example.com",
                    "password": "WrongPass1234",
                    "token": "mock_turnstile",
                },
            )
        self.assertEqual(resp.status_code, 401)

    async def test_login_nonexistent_user(self):
        with patch(
            "apps.accounts.services.AuthService.averify_turnstile",
            AsyncMock(return_value=True),
        ):
            resp = await _client().post(
                "/auth/pair",
                json={
                    "email": "nobody@example.com",
                    "password": "StrongPass1234",
                    "token": "mock_turnstile",
                },
            )
        self.assertEqual(resp.status_code, 401)

    async def test_login_failed_turnstile(self):
        await acreate_user(email="noturn@example.com", password="StrongPass1234")
        with patch(
            "apps.accounts.services.AuthService.averify_turnstile",
            AsyncMock(return_value=False),
        ):
            resp = await _client().post(
                "/auth/pair",
                json={
                    "email": "noturn@example.com",
                    "password": "StrongPass1234",
                    "token": "bad",
                },
            )
        self.assertEqual(resp.status_code, 400)
