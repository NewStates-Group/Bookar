import logging
from django.conf import settings
from django.db.models import Prefetch
from django.db.models.query import QuerySet
from ninja.errors import HttpError
from django.utils import timezone

from .models import Choice, Course, Lesson, Question, Quiz, QuizAttempt, Module, CourseEnrollment, LessonProgress, CourseShare, CourseShareClaim
import uuid
from .tasks import (
    create_course_details,
    generate_lesson,
    generate_next_module,
    generate_certificate_task,
)

logger = logging.getLogger(__name__)


class CourseService:
    def list_courses(self, user) -> QuerySet[Course]:
        # Return courses user is enrolled in and HAS NOT DELETED
        enrolled_ids = (
            CourseEnrollment.objects.filter(user=user, deleted=False)
            .values_list("course_id", flat=True)
        )
        return Course.objects.filter(id__in=enrolled_ids).order_by("-created_at")

    def get_course(self, id: str, user=None) -> Course:
        try:
            course = Course.objects.prefetch_related(
                Prefetch(
                    "modules",
                    queryset=Module.objects.order_by("created_at").prefetch_related(
                        Prefetch("lessons", queryset=Lesson.objects.order_by("id"))
                    ),
                )
            ).get(uuid=id)

            if user:
                # Update last_accessed_at on enrollment
                CourseEnrollment.objects.filter(course=course, user=user).update(
                    last_accessed_at=timezone.now()
                )

                for module in course.modules.all():
                    if hasattr(module, "quiz"):
                        last_attempt = (
                            module.quiz.attempts.filter(user=user)
                            .order_by("-completed_at")
                            .first()
                        )
                        if last_attempt:
                            module._last_quiz_score = last_attempt.score
                            module._last_quiz_passed = last_attempt.passed

            return course
        except Course.DoesNotExist:
            raise HttpError(404, "Curso não encontrado")

    def create_course(self, user, prompt: str, level: str, num_modules: int = None) -> Course:
        # 1. Check if the current user already has this course (enrolled and not deleted)
        user_enrollment = CourseEnrollment.objects.filter(
            user=user,
            course__level=level,
            course__generation_context__prompt=prompt,
            deleted=False
        ).first()
        
        if user_enrollment:
            logger.info(f"User {user.id} already has enrollment in course {user_enrollment.course_id}")
            return user_enrollment.course

        # 2. Check if ANY course with this prompt already exists and is READY
        from .models import CourseGenerationContext
        existing_context = CourseGenerationContext.objects.filter(
            prompt=prompt, 
            course__level=level, 
            course__status="READY"
        ).order_by("-created_at").first()

        if existing_context:
            existing_course = existing_context.course
            logger.info(f"Reusing existing course {existing_course.id} for prompt '{prompt}'")
            
            # Instead of duplicating, just enroll the user in the existing course
            self.enroll_course(user, existing_course.id)
            return existing_course

        # 3. If no existing course, create new one
        # Course no longer has 'user' (owner) field. First enrollment identifies creator.
        course = Course.objects.create(level=level, max_modules=num_modules or 4)
        # Owner must be enrolled
        self.enroll_course(user, course.id)
        
        create_course_details.delay(user.id, course.pk, prompt, course.get_level_display())
        return course

    def delete_course(self, course_id: str, user):
        try:
            # We "soft delete" the enrollment instead of the course itself
            enrollment = CourseEnrollment.objects.get(course__uuid=course_id, user=user)
            enrollment.deleted = True
            enrollment.save()
            return {"success": True}
        except CourseEnrollment.DoesNotExist:
             raise HttpError(404, "Curso não encontrado ou sem permissão")

    def cancel_course(self, user, course_id: str):
        # Cancel is usually for when it's still PROCESSING
        try:
            # Check if this user is the "creator" (first enrolled)
            course = Course.objects.get(uuid=course_id)
            if course.creator == user:
                course.status = "CANCELLED"
                course.save(update_fields=["status"])
            
            # Always mark user's enrollment as deleted
            CourseEnrollment.objects.filter(course=course, user=user).update(deleted=True)
            return {"success": True, "message": "Curso cancelado e removido."}
        except Course.DoesNotExist:
            raise HttpError(404, "Curso não encontrado")

    def enroll_course(self, user, course_id) -> CourseEnrollment:
        try:
            course = Course.objects.get(id=course_id)
            enrollment, created = CourseEnrollment.objects.get_or_create(
                user=user, course=course
            )
            if enrollment.deleted:
                enrollment.deleted = False
                enrollment.save()
            return enrollment
        except Course.DoesNotExist:
            raise HttpError(404, "Curso não encontrado")

    def mark_lesson_watched(self, user, lesson_id: str):
        try:
            lesson = Lesson.objects.get(short_id=lesson_id)
            LessonProgress.objects.update_or_create(
                user=user, 
                lesson=lesson,
                defaults={"watched": True}
            )
            return {"success": True}
        except Lesson.DoesNotExist:
            raise HttpError(404, "Lição não encontrada")

    def get_next_lesson(self, user, course_id: str, current_lesson_id: str = "0"):
        if current_lesson_id != "0":
            return (
                Lesson.objects.filter(module__course__uuid=course_id)
                .only("module", "id", "status")
                .order_by("module__created_at", "id")
                .filter(short_id__gt=current_lesson_id)
                .first()
            )
        
        # Get all lessons for the course
        all_lessons = Lesson.objects.filter(
            module__course__uuid=course_id
        ).order_by("module__created_at", "module__id", "id")
        
        # Find the first one not watched by the user
        for lesson in all_lessons:
            if not LessonProgress.objects.filter(user=user, lesson=lesson, watched=True).exists():
                return lesson
        
        return None

    def get_quiz(self, lesson_id: str) -> Quiz:
        try:
            return Quiz.objects.get(lesson__short_id=lesson_id)
        except Quiz.DoesNotExist:
            raise HttpError(404, "Quiz ainda não disponível")

    def get_module_quiz(self, user, module_id: str) -> Quiz:
        try:
            module = Module.objects.prefetch_related("lessons").get(uuid=module_id)
            # Check if all lessons are watched by this user
            total_lessons = module.lessons.count()
            watched_count = LessonProgress.objects.filter(
                lesson__module=module, user=user, watched=True
            ).count()
            
            if watched_count < total_lessons:
                raise HttpError(400, "Você precisa assistir a todas as aulas antes de iniciar o quiz.")
            
            return Quiz.objects.get(module__uuid=module_id)
        except Module.DoesNotExist:
            raise HttpError(404, "Módulo não encontrado")
        except Quiz.DoesNotExist:
            raise HttpError(404, "Quiz ainda não disponível")

    def submit_quiz(self, user, quiz_id: str, answers: list) -> dict:
        try:
            quiz = Quiz.objects.get(uuid=quiz_id)
        except Quiz.DoesNotExist:
            raise HttpError(404, "Quiz não encontrado")

        total_questions = quiz.questions.count()
        if total_questions == 0:
            return {"score": 100, "passed": True, "correct_answers": []}

        correct_count = 0
        correct_choice_ids = []

        for ans in answers:
            try:
                question = Question.objects.get(uuid=ans.question_id, quiz=quiz)
                choice = Choice.objects.get(uuid=ans.choice_id, question=question)
                if choice.is_correct:
                    correct_count += 1
                    correct_choice_ids.append(choice.id)
                else:
                    correct_choice = question.choices.filter(is_correct=True).first()
                    if correct_choice:
                        correct_choice_ids.append(correct_choice.id)
            except (Question.DoesNotExist, Choice.DoesNotExist):
                continue

        all_correct = Choice.objects.filter(
            question__quiz=quiz, is_correct=True
        ).values_list("uuid", flat=True)

        score = (correct_count / total_questions) * 10.0
        passed = score >= 7.0

        QuizAttempt.objects.create(user=user, quiz=quiz, score=score, passed=passed)

        return {"score": score, "passed": passed, "correct_answers": [str(u) for u in all_correct]}

    def trigger_next_module(self, user_pk, course_id: str):
        from accounts.models import User
        user = User.objects.get(pk=user_pk)
        try:
            course = Course.objects.get(uuid=course_id)
            current_module_count = course.modules.count()
            
            if course.max_modules and current_module_count >= course.max_modules:
                raise HttpError(400, f"Limite de módulos atingido ({course.max_modules})")

            # Check if the previous module is completed for this user
            last_module = course.modules.order_by("id").last()
            if last_module:
                # Check lessons watched by consumer
                total_lessons = last_module.lessons.count()
                watched_count = LessonProgress.objects.filter(
                    lesson__module=last_module, user=user, watched=True
                ).count()
                
                if watched_count < total_lessons:
                    raise HttpError(400, "Você precisa assistir a todas as aulas do módulo anterior para avançar.")
                
                try:
                    # Check if the module quiz is passed
                    quiz = last_module.quiz
                    if quiz:
                        passed = QuizAttempt.objects.filter(
                            user=user, quiz=quiz, passed=True
                        ).exists()
                        if not passed:
                            raise HttpError(400, "Você precisa passar no quiz do módulo anterior para avançar.")
                except Quiz.DoesNotExist:
                    pass # No quiz for previous module, allow proceed
            
            # Pre-create the module in PROCESSING status
            new_module = Module.objects.create(
                course=course,
                name="Gerando módulo...",
                status="PROCESSING"
            )
            
            generate_next_module.delay(user_pk, course_id, new_module.pk)
            return {"success": True, "message": "Gerando módulo...", "module_id": new_module.pk}
        except Course.DoesNotExist:
            raise HttpError(404, "Curso não encontrado")

    def get_certificate_info(self, user, course_id: str):
        course = Course.objects.get(uuid=course_id)
        enrollment = CourseEnrollment.objects.get(course=course, user=user)
        
        # Verify completion for THIS user
        if not course.is_fully_completed(user):
            raise HttpError(400, "O curso ainda não foi totalmente concluído.")

        if enrollment.certificate_status == "READY":
             return {"status": "READY", "certificate_url": enrollment.certificate_file.url}

        if enrollment.certificate_status == "PROCESSING":
            return {"status": "PROCESSING", "message": "Seu certificado está sendo gerado."}

        # If NOT_GENERATED, trigger generation
        full_name = f"{user.first_name} {user.last_name}".strip()
        if not full_name:
            full_name = user.username

        enrollment.certificate_status = "PROCESSING"
        enrollment.save()
        
        generate_certificate_task.delay(user.id, course.id, full_name)

        return {"status": "PROCESSING", "message": "Certificado está a ser gerado. Enviaremos um e-mail brevemente."}

    def generate_share_token(self, user, course_id: str) -> CourseShare:
        try:
            course = Course.objects.get(uuid=course_id)
            # Check if user is enrolled
            if not CourseEnrollment.objects.filter(course=course, user=user).exists():
                raise HttpError(403, "Sem permissão para partilhar este curso")

            # Check if a share already exists for this user and course
            share, created = CourseShare.objects.get_or_create(
                course=course,
                sharer=user,
                defaults={"token": str(uuid.uuid4())}
            )
            return self.get_share_info(share.token)
        except Course.DoesNotExist:
            raise HttpError(404, "Curso não encontrado")

    def get_share_info(self, token: str) -> dict:
        try:
            share = CourseShare.objects.select_related("course", "sharer").get(token=token)
            return {
                "token": share.token,
                "course_id": str(share.course.uuid),
                "course_title": share.course.title,
                "sharer_name": f"{share.sharer.first_name} {share.sharer.last_name}".strip() or share.sharer.username,
                "created_at": share.created_at
            }
        except CourseShare.DoesNotExist:
            raise HttpError(404, "Link de partilha inválido ou expirado")

    def claim_share(self, user, token: str) -> dict:
        try:
            share = CourseShare.objects.get(token=token)
            # Enroll the user
            self.enroll_course(user, share.course.id)
            
            # Track the claim
            CourseShareClaim.objects.get_or_create(
                share=share,
                recipient=user
            )
            
            return {
                "success": True, 
                "message": "Curso importado com sucesso!",
                "course_id": str(share.course.uuid)
            }
        except CourseShare.DoesNotExist:
            raise HttpError(404, "Link de partilha inválido")

    def get_course_claims(self, user, course_id: str) -> list:
        # Get claims for shares of this course created by this user
        claims = CourseShareClaim.objects.filter(
            share__course__uuid=course_id,
            share__sharer=user
        ).select_related("recipient").order_by("-claimed_at")
        
        return [
            {
                "recipient_name": f"{c.recipient.first_name} {c.recipient.last_name}".strip() or c.recipient.username,
                "claimed_at": c.claimed_at
            } for c in claims
        ]


class LessonService:
    def get_lesson(self, user, lesson_id: str):
        # Allow access if user is enrolled
        lesson = Lesson.objects.select_related("module__course").get(short_id=lesson_id)
        course = lesson.module.course
        if CourseEnrollment.objects.filter(course=course, user=user, deleted=False).exists():
            return lesson
        return None

    def mark_watched(self, user, lesson_id: str):
        try:
            lesson = Lesson.objects.get(short_id=lesson_id)
            from .models import LessonProgress
            progress, created = LessonProgress.objects.update_or_create(
                user=user,
                lesson=lesson,
                defaults={"watched": True}
            )
            return {"success": True}
        except Lesson.DoesNotExist:
            raise HttpError(404, "Lição não encontrada")

    def mark_delivered(self, user, lesson_id: str):
        try:
             # Ownership check for delivery: only a user enrolled in the course should be able to trigger this?
             # Or only the "creator"? 
            lesson = Lesson.objects.get(short_id=lesson_id)
            course = lesson.module.course
            if not CourseEnrollment.objects.filter(course=course, user=user).exists():
                raise HttpError(403, "Sem permissão")

            if not lesson.delivered:
                lesson.delivered = True
                lesson.save(update_fields=["delivered"])

                course_id = lesson.module.course_id
                next_undelivered_lesson = (
                    Lesson.objects.filter(
                        module__course_id=course_id,
                        delivered=False,
                    )
                    .only("module", "id", "status", "delivered")
                    .order_by("module__created_at", "module__id", "id")
                    .first()
                )
                if (
                    next_undelivered_lesson
                    and next_undelivered_lesson.status == "PENDING"
                ):
                    generate_lesson.delay(user.id, next_undelivered_lesson.id)
                    return {"success": True}
                return {"info": "Sem aulas restantes"}
            return {"error": "Já foi entregue"}
        except Lesson.DoesNotExist:
            raise HttpError(404, "Lição não encontrada")
