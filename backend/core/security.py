import time
import redis
import requests
from django.conf import settings
from django.http import HttpRequest
from ninja.errors import HttpError
from functools import wraps

# Redis connection for throttling
redis_client = redis.from_url(settings.CELERY_BROKER_URL)

def get_client_ip(request: HttpRequest):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def throttle(limit: int, period: int, block: bool = True):
    """
    Redis-based throttling decorator.
    limit: number of requests
    period: time window in seconds
    """
    def decorator(func):
        @wraps(func)
        def wrapper(request: HttpRequest, *args, **kwargs):
            ip = get_client_ip(request)
            key = f"throttle:{func.__name__}:{ip}"
            
            # Use Redis pipeline for atomic increment and expire
            pipe = redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, period)
            results = pipe.execute()
            
            count = results[0]
            if count > limit:
                if block:
                    # Optional: Add IP to a temporary blacklist if limit is exceeded too much
                    if count > limit * 2:
                        redis_client.setex(f"blacklist:{ip}", 3600, "1")
                    
                    raise HttpError(429, "Too Many Requests")
            
            # Check if IP is blacklisted
            if redis_client.get(f"blacklist:{ip}"):
                raise HttpError(403, "Access Denied")
                
            return func(request, *args, **kwargs)
        return wrapper
    return decorator

def verify_turnstile(token: str, ip: str = None):
    """
    Verify Cloudflare Turnstile token.
    """
    if not token:
        return False
    
    secret_key = getattr(settings, "TURNSTILE_SECRET_KEY", None)
    if not secret_key:
        # If no secret key is configured, skip verification (useful for dev)
        if settings.DEBUG:
            return True
        return False
        
    response = requests.post(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        data={
            "secret": secret_key,
            "response": token,
            "remoteip": ip,
        }
    )
    result = response.json()
    return result.get("success", False)

class CookieJWTAuth(JWTAuth):
    def authenticate(self, request):
        token = request.COOKIES.get("access_token")
        if token:
            request.META["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        return super().authenticate(request)
