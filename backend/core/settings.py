from datetime import timedelta
from pathlib import Path

import environ

env = environ.Env()
environ.Env.read_env()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = "django-insecure-a7ht-+08f*@^n7%xe=9fm*u+1ga-+!kc#bdt%+ir(k^-qc1eyg"

DEBUG = True

ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "daphne",
    "ninja_extra",
    "ninja_jwt",
    "ninja_jwt.token_blacklist",
    "corsheaders",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "courses",
    "accounts",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

ASGI_APPLICATION = "core.asgi.application"

SITE_URL = env("SITE_URL", default="")

DATABASES = {
    "default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR}/db.sqlite3"),
}

AUTH_USER_MODEL = "accounts.User"

NINJA_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "BLACKLIST_AFTER_ROTATION": True,
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": env("REDIS_URL", default="redis://redis:6379/0"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "pt-br"

TIME_ZONE = "Africa/Luanda"

USE_I18N = False

USE_TZ = True

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR.joinpath("media")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOW_CREDENTIALS = True
CORS_ORIGIN_ALLOW_ALL = True

CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="")
CELERY_TIMEZONE = TIME_ZONE

AI = {
    "OLLAMA_KEY": env("OLLAMA_KEY", default=""),
    "GENAI_KEY": env("GENAI_KEY", default=""),
    "OLLAMA_MODEL_TEXT": "gpt-oss:120b-cloud",
    "GENAI_MODEL_IMAGE": "gemini-2.5-flash-image",
    "GENAI_MODEL_AUDIO": "gemini-2.5-flash-preview-tts",
    "GENAI_MODEL_TEXT": "gemini-2.0-flash",
}

GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID", default="")

# Email Configuration
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = "newstates.bookar@gmail.com"
EMAIL_HOST_PASSWORD = env("EMAIL_PASSWORD", default="")
DEFAULT_FROM_EMAIL = f"Bookar <{EMAIL_HOST_USER}>"
