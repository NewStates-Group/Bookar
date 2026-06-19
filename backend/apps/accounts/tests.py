from unittest.mock import AsyncMock, patch

from django.contrib.auth import get_user_model
from django.test import TransactionTestCase, override_settings
from ninja_extra.testing import TestAsyncClient

from core.api import api
from utils.tests import acreate_user, aget_tokens_for_user, auth_header

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


class TestProfile(TransactionTestCase):
    async def test_get_me_authenticated(self):
        user = await acreate_user()
        tokens = await aget_tokens_for_user(user)
        resp = await _client().get(
            "/auth/me", headers=auth_header(tokens["access"])
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["email"], user.email)

    async def test_get_me_unauthenticated(self):
        resp = await _client().get("/auth/me")
        self.assertEqual(resp.status_code, 401)

    async def test_update_profile(self):
        user = await acreate_user()
        tokens = await aget_tokens_for_user(user)
        resp = await _client().post(
            "/auth/profile",
            data={"first_name": "Updated"},
            headers=auth_header(tokens["access"]),
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["first_name"], "Updated")


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


class TestHealthcheck(TransactionTestCase):
    async def test_healthcheck(self):
        resp = await _client().get("/healthcheck/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.content, b"ok")
