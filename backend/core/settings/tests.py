import os

os.environ["NINJA_SKIP_REGISTRY"] = "1"

from .base import *  # noqa

NINJA_EXTRA = {
    "THROTTLE_RATES": {
        "anon": "1000/m",
        "send_verification": "1000/m",
        "verify_code": "1000/m",
        "email_check": "1000/m",
        "password_reset_request": "1000/m",
        "password_reset_confirm": "1000/m",
    }
}

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.InMemoryStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

