import logging
from django.conf import settings
from django.db.models import Prefetch
from django.db.models.query import QuerySet
from ninja.errors import HttpError
from django.utils import timezone

from .models import Choice, Course, Lesson, Question, Quiz, QuizAttempt, Module, CourseEnrollment, LessonProgress
from .tasks import (
    create_course_details,
    generate_lesson,
    generate_next_module,
    generate_certificate_task,
)

logger = logging.getLogger(__name__)


class CourseService:
    def list_courses(self, user) -> QuerySet[Course]:
        # Return courses owned by user OR courses user is enrolled in
        owned_ids = (
            Course.objects.filter(user=user, deleted=False)
            .values_list("id", flat=True)
        )
        enrolled_ids = (
            CourseEnrollment.objects.filter(user=user)
            .values_list("course_id", flat=True)
        )
        all_ids = set(owned_ids) | set(enrolled_ids)
        
        return Course.objects.filter(id__in=all_ids, deleted=False).order_by("-created_at")

    def get_course(self, id: int, user=None) -> Course:
        try:
            course = Course.objects.prefetch_related(
                Prefetch(
                    "modules",
                    queryset=Module.objects.order_by("created_at").prefetch_related(
                        Prefetch("lessons", queryset=Lesson.objects.order_by("id"))
                    ),
                )
            ).get(pk=id)

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
        # 1. Check if the current user already has this course (same prompt and level)
        from .models import CourseGenerationContext
        user_existing_course = Course.objects.filter(
            user=user,
            level=level,
            generation_context__prompt=prompt,
            deleted=False
        ).first()
        
        if user_existing_course:
            logger.info(f"User {user.id} already has course {user_existing_course.id} for prompt '{prompt}'")
            return user_existing_course

        # 2. Check if ANY course with this prompt already exists and is READY
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
        course = Course.objects.create(user=user, level=level, max_modules=num_modules or 5)
        create_course_details.delay(course.pk, prompt, course.get_level_display())
        return course

    def delete_course(self, course_id: int, user):
        try:
            # If the user is the owner, we can mark as deleted
            course = Course.objects.get(pk=course_id, user=user)
            course.deleted = True
            if course.status == "PROCESSING":
                course.status = "CANCELLED"
            course.save(update_fields=["deleted", "status"])
            return {"success": True}
        except Course.DoesNotExist:
            # If the user is just enrolled, they can remove the enrollment
            enrollment = CourseEnrollment.objects.filter(course_id=course_id, user=user).first()
            if enrollment:
                enrollment.delete()
                return {"success": True}
            else:
                raise HttpError(404, "Curso não encontrado ou sem permissão")

    def cancel_course(self, user, course_id: int):
        try:
            course = Course.objects.get(pk=course_id, user=user)
            course.status = "CANCELLED"
            course.deleted = True
            course.save(update_fields=["status", "deleted"])
            return {"success": True, "message": "Curso cancelado e removido."}
        except Course.DoesNotExist:
            # Try to just remove enrollment
            enrollment = CourseEnrollment.objects.filter(course_id=course_id, user=user).first()
            if enrollment:
                enrollment.delete()
                return {"success": True, "message": "Matrícula removida."}
            raise HttpError(404, "Curso não encontrado")

    def enroll_course(self, user, course_id: int) -> CourseEnrollment:
        try:
            course = Course.objects.get(pk=course_id)
            enrollment, created = CourseEnrollment.objects.get_or_create(
                user=user, course=course
            )
            return enrollment
        except Course.DoesNotExist:
            raise HttpError(404, "Curso não encontrado")

    def mark_lesson_watched(self, user, lesson_id: int):
        try:
            lesson = Lesson.objects.get(pk=lesson_id)
            LessonProgress.objects.update_or_create(
                user=user, 
                lesson=lesson,
                defaults={"watched": True}
            )
            return {"success": True}
        except Lesson.DoesNotExist:
            raise HttpError(404, "Lição não encontrada")

    def get_next_lesson(self, user, course_id: int, current_lesson: int = 0):
        if current_lesson:
            return (
                Lesson.objects.filter(module__course_id=course_id)
                .only("module", "id", "status")
                .order_by("module__created_at", "id")
                .filter(id__gt=current_lesson)
                .first()
            )
        
        # Get all lessons for the course
        all_lessons = Lesson.objects.filter(
            module__course_id=course_id
        ).order_by("module__created_at", "module__id", "id")
        
        # Find the first one not watched by the user
        for lesson in all_lessons:
            if not LessonProgress.objects.filter(user=user, lesson=lesson, watched=True).exists():
                return lesson
        
        return None

    def get_quiz(self, lesson_id: int) -> Quiz:
        try:
            return Quiz.objects.get(lesson_id=lesson_id)
        except Quiz.DoesNotExist:
            raise HttpError(404, "Quiz ainda não disponível")

    def get_module_quiz(self, user, module_id: int) -> Quiz:
        try:
            module = Module.objects.prefetch_related("lessons").get(pk=module_id)
            # Check if all lessons are watched by this user
            total_lessons = module.lessons.count()
            watched_count = LessonProgress.objects.filter(
                lesson__module=module, user=user, watched=True
            ).count()
            
            if watched_count < total_lessons:
                raise HttpError(400, "Você precisa assistir a todas as aulas antes de iniciar o quiz.")
            
            return Quiz.objects.get(module_id=module_id)
        except Module.DoesNotExist:
            raise HttpError(404, "Módulo não encontrado")
        except Quiz.DoesNotExist:
            raise HttpError(404, "Quiz ainda não disponível")

    def submit_quiz(self, user, quiz_id: int, answers: list) -> dict:
        try:
            quiz = Quiz.objects.get(pk=quiz_id)
        except Quiz.DoesNotExist:
            raise HttpError(404, "Quiz não encontrado")

        total_questions = quiz.questions.count()
        if total_questions == 0:
            return {"score": 100, "passed": True, "correct_answers": []}

        correct_count = 0
        correct_choice_ids = []

        for ans in answers:
            try:
                question = Question.objects.get(pk=ans.question_id, quiz=quiz)
                choice = Choice.objects.get(pk=ans.choice_id, question=question)
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
        ).values_list("id", flat=True)

        score = (correct_count / total_questions) * 10.0
        passed = score >= 7.0

        QuizAttempt.objects.create(user=user, quiz=quiz, score=score, passed=passed)

        return {"score": score, "passed": passed, "correct_answers": list(all_correct)}

    def trigger_next_module(self, user_pk, course_id: int):
        from accounts.models import User
        user = User.objects.get(pk=user_pk)
        try:
            course = Course.objects.get(pk=course_id)
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

    def get_certificate_info(self, user, course_id: int):
        course = Course.objects.get(pk=course_id)
        
        # Verify completion for THIS user
        if not course.is_fully_completed(user):
            raise HttpError(400, "O curso ainda não foi totalmente concluído.")

        # If PROCESSING, just return status
        if course.certificate_status == "READY":
             # We should probably have a Certificate model if multiple users can get it for same course
             # For now, if Course record is shared, the certificate_file on Course model is problematic.
             # USER said "reaproveitar curso ... com metadados como data de criacao".
             # This implies CourseEnrollment is the "record".
             # So maybe the certificate should be tracked on enrollment.
             pass

        if course.certificate_status == "PROCESSING":
            return {"status": "PROCESSING", "message": "Seu certificado está sendo gerado."}

        # If NOT_GENERATED, trigger generation
        full_name = f"{user.first_name} {user.last_name}".strip()
        if not full_name:
            full_name = user.username

        course.certificate_status = "PROCESSING"
        course.save()
        
        generate_certificate_task.delay(user.id, course.id, full_name)

        return {"status": "PROCESSING", "message": "Solicitação iniciada. Você receberá um e-mail em breve."}


class LessonService:
    def get_lesson(self, user, lesson_id: int):
        # Allow access if user owns or is enrolled
        lesson = Lesson.objects.select_related("module__course").get(id=lesson_id)
        course = lesson.module.course
        if course.user == user or CourseEnrollment.objects.filter(course=course, user=user).exists():
            return lesson
        return None

    def mark_watched(self, user, lesson_id: int):
        try:
            lesson = Lesson.objects.get(id=lesson_id)
            from .models import LessonProgress
            progress, created = LessonProgress.objects.update_or_create(
                user=user,
                lesson=lesson,
                defaults={"watched": True}
            )
            return {"success": True}
        except Lesson.DoesNotExist:
            raise HttpError(404, "Lição não encontrada")

    def mark_delivered(self, user, lesson_id: int):
        try:
            lesson = Lesson.objects.get(id=lesson_id, module__course__user=user)
            if not lesson.delivered:
                lesson.delivered = True
                lesson.save(update_fields=["delivered"])

                course_id = lesson.module.course_id
                next_undelivered_lesson = (
                    Lesson.objects.filter(
                        module__course__user=user,
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
