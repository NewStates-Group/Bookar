from datetime import timedelta
from pathlib import Path

import environ

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
)

BASE_DIR = Path(__file__).resolve().parent.parent

# environ.Env.read_env(BASE_DIR.parent / ".env")

SECRET_KEY = env("SECRET_KEY")

DEBUG = env("DEBUG")

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")

INSTALLED_APPS = [
    "daphne",
    "ninja_extra",
    "ninja_jwt",
    "ninja_jwt.token_blacklist",
    "corsheaders",
    "cloudinary_storage",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "channels",
    "cloudinary",
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

CLOUDINARY_STORAGE = {
    "CLOUD_NAME": env("CLOUDINARY_CLOUD_NAME"),
    "API_KEY": env("CLOUDINARY_API_KEY"),
    "API_SECRET": env("CLOUDINARY_API_SECRET"),
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CELERY_BROKER_URL = env("REDIS_URL")
CELERY_RESULT_BACKEND = env("REDIS_URL")
CELERY_TIMEZONE = TIME_ZONE

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS")

AI = {
    "OLLAMA_KEY": env("OLLAMA_KEY"),
    "GENAI_KEY": env("GENAI_KEY"),
    "OLLAMA_MODEL_TEXT": env("OLLAMA_MODEL_TEXT"),
    "GENAI_MODEL_IMAGE": env("GENAI_MODEL_IMAGE"),
    "GENAI_MODEL_AUDIO": env("GENAI_MODEL_AUDIO"),
    "GENAI_MODEL_TEXT": env("GENAI_MODEL_TEXT"),
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
