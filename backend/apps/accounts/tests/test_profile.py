from django.test import TransactionTestCase
from ninja_extra.testing import TestAsyncClient

from core.api import api
from utils.tests import acreate_user, aget_tokens_for_user, auth_header


def _client():
    return TestAsyncClient(api)


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
