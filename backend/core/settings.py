from datetime import timedelta
from pathlib import Path

import environ
from corsheaders.defaults import default_headers

env = environ.Env(
    SECRET_KEY=(str, "django-example-secret-key"),
    DEBUG=(bool, False),
    SITE_URL=(str, "http://localhost:3000"),
    DATABASE_URL=(str, "sqlite:///:memory:"),
    REDIS_URL=(str, "redis://redis:6379/0"),
    ALLOWED_HOSTS=(list, ["*"]),
    CLOUDINARY_CLOUD_NAME=(str, ""),
    CLOUDINARY_API_KEY=(str, ""),
    CLOUDINARY_API_SECRET=(str, ""),
    REPLICATE_API_TOKEN=(str, ""),
)

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = env("SECRET_KEY")

DEBUG = env("DEBUG")

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")

INSTALLED_APPS = [
    "ninja_extra",
    "ninja_jwt",
    "ninja_jwt.token_blacklist",
    "corsheaders",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "cloudinary_storage",
    "cloudinary",
    "courses",
    "accounts",
    "channels",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
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

SITE_URL = env("SITE_URL")

DATABASES = {
    "default": env.db(),
}

AUTH_USER_MODEL = "accounts.User"

NINJA_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "BLACKLIST_AFTER_ROTATION": True,
}

CACHES = {"default": env.cache_url("REDIS_URL")}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [
                {
                    "address": env.str("REDIS_URL"),
                    "ssl_cert_reqs": None,
                }
            ],
        },
    },
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

STORAGES = {
    "default": {
        "BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

DEFAULT_FILE_STORAGE = "cloudinary_storage.storage.MediaCloudinaryStorage"

CLOUDINARY_STORAGE = {
    "CLOUD_NAME": env("CLOUDINARY_CLOUD_NAME"),
    "API_KEY": env("CLOUDINARY_API_KEY"),
    "API_SECRET": env("CLOUDINARY_API_SECRET"),
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CELERY_REDIS_URL = env.str("REDIS_URL")
CELERY_BROKER_URL = CELERY_REDIS_URL
CELERY_RESULT_BACKEND = CELERY_REDIS_URL
CELERY_TIMEZONE = TIME_ZONE

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_HEADERS = (
    *default_headers,
    "retry-after",
)
CORS_EXPOSE_HEADERS = [
    "Retry-After",
]

AI = {
    "OLLAMA_KEY": env("OLLAMA_KEY"),
    "GENAI_KEY": env("GENAI_KEY"),
    "OPENROUTER_KEY": env("OPENROUTER_KEY", default=""),
    "ELEVENLABS_KEY": env("ELEVENLABS_KEY", default=""),
    "OLLAMA_MODEL_TEXT": env("OLLAMA_MODEL_TEXT"),
    "GENAI_MODEL_IMAGE": env("GENAI_MODEL_IMAGE"),
    "GENAI_MODEL_AUDIO": env("GENAI_MODEL_AUDIO"),
    "GENAI_MODEL_TEXT": env("GENAI_MODEL_TEXT"),
    "OPENROUTER_MODEL_TEXT": env(
        "OPENROUTER_MODEL_TEXT", default="google/gemma-4-26b-a4b-it:free"
    ),
    "OPENROUTER_MODEL_IMAGE": env(
        "OPENROUTER_MODEL_IMAGE", default="sourceful/riverflow-v2-fast"
    ),
    "REPLICATE_API_TOKEN": env("REPLICATE_API_TOKEN"),
    "REPLICATE_MODEL_IMAGE": env("REPLICATE_MODEL_IMAGE", default="google/imagen-4"),
    "ELEVENLABS_VOICE_ID": env("ELEVENLABS_VOICE_ID", default="pNInz6obpg8ndclQU7Nc"),
}

GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = env("GOOGLE_CLIENT_SECRET")

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = "newstates.bookar@gmail.com"
EMAIL_HOST_PASSWORD = env("EMAIL_PASSWORD")
DEFAULT_FROM_EMAIL = f"Bookar <{EMAIL_HOST_USER}>"

NINJA_EXTRA = {
    "THROTTLE_RATES": {
        "anon": "3/3m",
        "send_verification": "3/5m",
        "verify_code": "3/3m",
        "email_check": "3/1m",
        "password_reset_request": "3/5m",
        "password_reset_confirm": "3/3m",
    }
}

CLOUDFLARE_TURNSTILE_SECRET_KEY = env("TURNSTILE_SECRET_KEY")
CLOUDFLARE_TURNSTILE_SITE_KEY = env("NEXT_PUBLIC_TURNSTILE_SITE_KEY")

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
