from django.test import TransactionTestCase
from ninja_extra.testing import TestAsyncClient

from core.api import api


def _client():
    return TestAsyncClient(api)


class TestHealthcheck(TransactionTestCase):
    async def test_healthcheck(self):
        resp = await _client().get("/healthcheck/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.content, b"ok")
