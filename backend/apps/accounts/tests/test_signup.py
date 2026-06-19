from unittest.mock import AsyncMock, patch

from django.contrib.auth import get_user_model
from django.test import TransactionTestCase, override_settings
from ninja_extra.testing import TestAsyncClient

from core.api import api
from utils.tests import acreate_user

User = get_user_model()


def _client():
    return TestAsyncClient(api)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class TestSignup(TransactionTestCase):
    async def test_signup_success(self):
        with (
            patch(
                "apps.accounts.services.AuthService.averify_turnstile",
                AsyncMock(return_value=True),
            ),
            patch(
                "apps.accounts.services.AuthService.averify_verification_code",
                AsyncMock(return_value=True),
            ),
        ):
            # First send verification code
            await _client().post(
                "/auth/send-verification",
                json={"email": "newuser@example.com"},
            )

            resp = await _client().post(
                "/auth/signup",
                json={
                    "first_name": "New",
                    "last_name": "User",
                    "email": "newuser@example.com",
                    "password": "StrongPass1234",
                    "code": "123456",
                    "token": "mock_turnstile",
                },
            )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["email"], "newuser@example.com")
        self.assertEqual(data["first_name"], "New")
        self.assertTrue(
            await User.objects.filter(email="newuser@example.com").aexists()
        )

    async def test_signup_duplicate_email(self):
        await acreate_user(email="existing@example.com")
        resp = await _client().post(
            "/auth/signup",
            json={
                "first_name": "New",
                "last_name": "User",
                "email": "existing@example.com",
                "password": "StrongPass1234",
                "code": "123456",
                "token": "mock_turnstile",
            },
        )
        self.assertEqual(resp.status_code, 422)

    async def test_signup_weak_password(self):
        resp = await _client().post(
            "/auth/signup",
            json={
                "first_name": "New",
                "last_name": "User",
                "email": "weak@example.com",
                "password": "short",
                "code": "123456",
                "token": "mock_turnstile",
            },
        )
        self.assertEqual(resp.status_code, 422)

    async def test_signup_missing_verification_code(self):
        with patch(
            "apps.accounts.services.AuthService.averify_turnstile",
            AsyncMock(return_value=True),
        ):
            resp = await _client().post(
                "/auth/signup",
                json={
                    "first_name": "New",
                    "last_name": "User",
                    "email": "nocode@example.com",
                    "password": "StrongPass1234",
                    "code": "wrong",
                    "token": "mock_turnstile",
                },
            )
        self.assertEqual(resp.status_code, 400)

    async def test_signup_failed_turnstile(self):
        with patch(
            "apps.accounts.services.AuthService.averify_turnstile",
            AsyncMock(return_value=False),
        ):
            resp = await _client().post(
                "/auth/signup",
                json={
                    "first_name": "New",
                    "last_name": "User",
                    "email": "noturn@example.com",
                    "password": "StrongPass1234",
                    "code": "123456",
                    "token": "bad_turnstile",
                },
            )
        self.assertEqual(resp.status_code, 400)
