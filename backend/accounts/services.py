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

    def get_google_auth_url(self):
        from django.conf import settings
        import urllib.parse
        
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": f"{settings.SITE_URL}/auth/callback",
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "select_account",
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    def google_callback(self, code):
        from django.conf import settings
        import httpx
        from ninja_jwt.tokens import RefreshToken
        import random
        import string

        # 1. Exchange code for tokens
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": f"{settings.SITE_URL}/auth/callback",
            "grant_type": "authorization_code",
        }

        with httpx.Client() as client:
            res = client.post(token_url, data=data)
            if not res.is_success:
                raise HttpError(400, f"Failed to exchange Google code: {res.text}")
            tokens = res.json()

        id_token_str = tokens.get("id_token")
        if not id_token_str:
            raise HttpError(400, "No id_token returned from Google")

        # 2. Verify token and get user
        from google.oauth2 import id_token
        from google.auth.transport import requests
        
        try:
            id_info = id_token.verify_oauth2_token(
                id_token_str, 
                requests.Request(), 
                settings.GOOGLE_CLIENT_ID
            )

            email = id_info.get('email')
            first_name = id_info.get('given_name', '')
            last_name = id_info.get('family_name', '')
            
            user = User.objects.filter(email__iexact=email).first()
            
            if not user:
                # Create new user
                base_username = email.split('@')[0]
                username = base_username
                
                # Ensure unique username with a robust loop
                counter = 1
                while User.objects.filter(username=username).exists():
                    import random
                    import string
                    suffix = ''.join(random.choices(string.digits, k=4))
                    username = f"{base_username}{suffix}"
                    # Safety break to avoid infinite loop (though very unlikely with random suffix)
                    counter += 1
                    if counter > 10:
                        username = f"{base_username}{''.join(random.choices(string.ascii_lowercase + string.digits, k=8))}"
                        break
                
                user = User.objects.create_user(
                    email=email,
                    username=username,
                    first_name=first_name,
                    last_name=last_name,
                    is_active=True
                )
            else:
                # Update existing user profile if fields are empty
                updated = False
                if not user.first_name and first_name:
                    user.first_name = first_name
                    updated = True
                if not user.last_name and last_name:
                    user.last_name = last_name
                    updated = True
                if updated:
                    user.save()

            # 3. Save profile picture from Google if available and user doesn't have one
            picture_url = id_info.get('picture')
            if picture_url and not user.avatar:
                try:
                    from django.core.files.base import ContentFile
                    import os
                    
                    with httpx.Client() as client:
                        resp = client.get(picture_url)
                        if resp.is_success:
                            ext = os.path.splitext(picture_url.split('?')[0])[1] or '.jpg'
                            user.avatar.save(f"{user.username}_google{ext}", ContentFile(resp.content), save=True)
                except Exception as img_err:
                    print(f"Failed to save Google profile picture: {img_err}")

            refresh = RefreshToken.for_user(user)
            return {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }

        except Exception as e:
            print(f"Google Token Verification Error: {str(e)}")
            raise HttpError(400, f"Erro na verificação do token Google: {str(e)}")

    def google_login(self, id_token_str):
        # Kept for backward compatibility if needed, but redesigned for better use
        from google.oauth2 import id_token
        from google.auth.transport import requests
        from django.conf import settings
        from ninja_jwt.tokens import RefreshToken
        import random
        import string

        try:
            id_info = id_token.verify_oauth2_token(
                id_token_str, 
                requests.Request(), 
                settings.GOOGLE_CLIENT_ID
            )

            iss = id_info.get('iss')
            if iss not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError(f'Wrong issuer: {iss}')

            email = id_info.get('email')
            if not email:
                raise ValueError('Email not found in Google Token')

            user = User.objects.filter(email__iexact=email).first()
            if not user:
                base_username = email.split('@')[0]
                username = base_username
                
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}{''.join(random.choices(string.digits, k=4))}"

                user = User.objects.create_user(
                    email=email,
                    username=username,
                    is_active=True
                )
            created = False # get_or_create replacement logic

            refresh = RefreshToken.for_user(user)
            return {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': user
            }

        except Exception as e:
            # Provide more detailed error message for easier debugging
            print(f"Google Token Verification Error: {str(e)}")
            raise HttpError(400, f"Erro na verificação do token Google: {str(e)}")

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
