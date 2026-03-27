from celery import shared_task
from core.mail import (
    send_verification_email,
    send_welcome_email,
    send_password_reset_email,
    send_certificate_email,
)
from django.contrib.auth import get_user_model
from courses.models import Course

User = get_user_model()


@shared_task
def send_verification_email_task(email, code):
    send_verification_email(email, code)


@shared_task
def send_welcome_email_task(user_id):
    try:
        user = User.objects.get(id=user_id)
        send_welcome_email(user)
    except User.DoesNotExist:
        pass


@shared_task
def send_password_reset_email_task(user_id, token):
    try:
        user = User.objects.get(id=user_id)
        send_password_reset_email(user, token)
    except User.DoesNotExist:
        pass


@shared_task
def send_certificate_email_task(user_id, course_id):
    try:
        user = User.objects.get(id=user_id)
        course = Course.objects.get(id=course_id)
        send_certificate_email(user, course)
    except (User.DoesNotExist, Course.DoesNotExist):
        pass
