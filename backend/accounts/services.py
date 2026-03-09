from django.contrib.auth import get_user_model
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from ninja.errors import HttpError
from core.mail import send_welcome_email, send_password_reset_email

User = get_user_model()


class AuthService:
    def create_user(self, username, email, password):
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
        )
        try:
            send_welcome_email(user)
        except Exception as e:
            print(f"Failed to send welcome email: {e}")
        return user

    def update_profile(self, user, data: dict, avatar=None):
        for attr, value in data.items():
            if value is not None:
                setattr(user, attr, value)
        
        if avatar:
            user.avatar = avatar
            
        user.save()
        return user

    def get_user_stats(self, user):
        from courses.models import Course
        
        all_courses = Course.objects.filter(user=user, deleted=False)
        
        # This is a bit expensive if many courses, but okay for MVP
        finished_ids = [c.id for c in all_courses if c.is_fully_completed]
        
        return {
            "ongoing_courses": all_courses.count() - len(finished_ids),
            "finished_courses": len(finished_ids),
            "certificates_issued": len(finished_ids), # Assuming 1:1 for now
        }

    def google_login(self, id_token_str):
        from google.oauth2 import id_token
        from google.auth.transport import requests
        from django.conf import settings
        from ninja_jwt.tokens import RefreshToken
        import random
        import string

        try:
            # Verify the ID token
            id_info = id_token.verify_oauth2_token(
                id_token_str, 
                requests.Request(), 
                settings.GOOGLE_CLIENT_ID
            )

            if id_info['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError('Wrong issuer.')

            email = id_info['email']
            user, created = User.objects.get_or_create(email=email, defaults={
                'username': email.split('@')[0] + ''.join(random.choices(string.digits, k=4)),
                'is_active': True
            })

            refresh = RefreshToken.for_user(user)
            return {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': user
            }

        except Exception as e:
            raise HttpError(400, f"Invalid Google Token: {str(e)}")

    def request_password_reset(self, email):
        try:
            user = User.objects.get(email=email)
            signer = TimestampSigner()
            token = signer.sign(user.email)
            send_password_reset_email(user, token)
        except User.DoesNotExist:
            # We don't reveal if user exists for security, but we don't send anything
            pass
        return {"message": "Se o e-mail existir no nosso sistema, você receberá um link de recuperação."}

    def confirm_password_reset(self, token, new_password):
        signer = TimestampSigner()
        try:
            # Token expires in 1 hour (3600 seconds)
            email = signer.unsign(token, max_age=3600)
            user = User.objects.get(email=email)
            user.set_password(new_password)
            user.save()
            return {"message": "Senha redefinida com sucesso!"}
        except (BadSignature, SignatureExpired):
            raise HttpError(400, "Token inválido ou expirado.")
        except User.DoesNotExist:
            raise HttpError(404, "Usuário não encontrado.")
