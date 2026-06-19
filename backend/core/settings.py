from datetime import timedelta
from pathlib import Path

from corsheaders.defaults import default_headers
from environ import Env as load_envs

env = load_envs()

BASE_DIR = Path(__file__).resolve().parent.parent

IMAGES_DIR = BASE_DIR / "images"

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])  # type: ignore
SECRET_KEY = env("SECRET_KEY", default="django-example-secret-key")  # type: ignore
DEBUG = env.bool("DEBUG", default=False)  # type: ignore
ENV = env("ENV", default="prod")  # type: ignore

DJANGO_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
]

THIRD_PARTY_APPS = [
    "ninja_extra",
    "ninja_jwt",
    "ninja_jwt.token_blacklist",
    "corsheaders",
    "cloudinary_storage",
    "cloudinary",
    "gmailapi_backend",
]

APPLICATION_APPS = [
    "apps.accounts",
    "apps.subscriptions",
    "apps.courses",
    "apps.mind_maps",
    "apps.explicador",
    "apps.folhas",
    "apps.feedback",
    "apps.notifications",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + APPLICATION_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.api"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": False,
    },
]

ASGI_APPLICATION = "core.asgi.application"

SITE_URL = env("SITE_URL")
API_URL = env("API_URL")

DATABASES = {
    "default": env.db(default="sqlite:///:memory:"),  # type: ignore
}

AUTH_USER_MODEL = "accounts.User"

NINJA_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
}

REDIS_URL = env("REDIS_URL", default="redis://redis:6379/0")  # type: ignore
PROD_REDIS_URL = REDIS_URL + env(
    "REDIS_URL_PARAMS",
    default="/?ssl_cert_reqs=CERT_NONE",  # type: ignore
)

CACHES = {"default": env.cache_url_config(REDIS_URL)}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [
                {
                    "address": REDIS_URL,
                    "ssl_cert_reqs": None,
                }
                if ENV == "prod"
                else REDIS_URL
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
}

DEFAULT_FILE_STORAGE = "cloudinary_storage.storage.MediaCloudinaryStorage"

CLOUDINARY_STORAGE = {
    "CLOUD_NAME": env("CLOUDINARY_CLOUD_NAME"),
    "API_KEY": env("CLOUDINARY_API_KEY"),
    "API_SECRET": env("CLOUDINARY_API_SECRET"),
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CELERY_BROKER_URL = PROD_REDIS_URL if ENV == "prod" else REDIS_URL
CELERY_RESULT_BACKEND = PROD_REDIS_URL if ENV == "prod" else REDIS_URL
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
    "AI_ENVIRONMENT": env("AI_ENVIRONMENT", default="production"),  # type:ignore
    "OLLAMA_KEY": env("OLLAMA_KEY"),
    "GENAI_KEY": env("GENAI_KEY"),
    "OLLAMA_MODEL_TEXT": env("OLLAMA_MODEL_TEXT"),
    "GENAI_MODEL_IMAGE": env("GENAI_MODEL_IMAGE"),
    "GENAI_MODEL_AUDIO": env("GENAI_MODEL_AUDIO"),
    "GENAI_MODEL_TEXT": env("GENAI_MODEL_TEXT"),
    "REPLICATE_API_TOKEN": env("REPLICATE_API_TOKEN"),
    "HF_API_KEY": env("HF_API_KEY"),
    "ELEVENLABS_KEY": env("ELEVENLABS_KEY"),
    "NVIDIA_AUDIO_API_KEY": env("NVIDIA_AUDIO_API_KEY"),
}

GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = env("GOOGLE_CLIENT_SECRET")

EMAIL_BACKEND = "gmailapi_backend.mail.GmailBackend"
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="newstates.bookar@gmail.com")  # type: ignore
DEFAULT_FROM_EMAIL = f"Bookar <{EMAIL_HOST_USER}>"

GMAIL_API_CLIENT_ID = env("GMAIL_API_CLIENT_ID")
GMAIL_API_CLIENT_SECRET = env("GMAIL_API_CLIENT_SECRET")
GMAIL_API_REFRESH_TOKEN = env("GMAIL_API_REFRESH_TOKEN")

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

STRIPE_SECRET_KEY = env("STRIPE_SECRET_KEY", default="")  # type: ignore
STRIPE_WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET", default="")  # type: ignore
STRIPE_PUBLISHABLE_KEY = env("NEXT_PUBLIC_STRIPE_KEY", default="")  # type: ignore

ADMIN_EMAILS = env.list("ADMIN_EMAILS", default=[])  # type: ignore

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
