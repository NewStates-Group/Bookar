from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings

def send_html_email(subject, template_name, context, recipient_list):
    """
    Utility to send HTML emails based on a template.
    """
    html_message = render_to_string(template_name, context)
    plain_message = strip_tags(html_message)
    from_email = settings.DEFAULT_FROM_EMAIL
    
    send_mail(
        subject,
        plain_message,
        from_email,
        recipient_list,
        html_message=html_message,
        fail_silently=False,
    )

def send_welcome_email(user):
    subject = "Bem-vindo ao Bookar!"
    context = {
        "username": user.username,
        "site_url": settings.SITE_URL
    }
    send_html_email(
        subject,
        "emails/welcome.html",
        context,
        [user.email]
    )

def send_certificate_email(user, course):
    subject = f"Seu Certificado do curso {course.title} está disponível! 🎓"
    context = {
        "username": user.username,
        "course_title": course.title,
        "site_url": settings.SITE_URL,
        "certificate_url": f"{settings.SITE_URL}/app/courses/{course.id}"
    }
    send_html_email(
        subject,
        "emails/certificate.html",
        context,
        [user.email]
    )

def send_password_reset_email(user, token):
    subject = "Recuperação de Senha - Bookar"
    reset_url = f"{settings.SITE_URL}/reset-password?token={token}"
    context = {
        "username": user.username,
        "reset_url": reset_url,
        "site_url": settings.SITE_URL
    }
    send_html_email(
        subject,
        "emails/password_reset.html",
        context,
        [user.email]
    )
