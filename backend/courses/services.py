import logging
from django.conf import settings
from django.db.models import Prefetch
from django.db.models.query import QuerySet
from ninja.errors import HttpError

from .models import Choice, Course, Lesson, Question, Quiz, QuizAttempt, Module
from .tasks import (
    create_course_details,
    generate_lesson,
    generate_next_module,
    generate_certificate_task,
)

logger = logging.getLogger(__name__)


class CourseService:
    def list_courses(self, user) -> QuerySet[Course]:
        return Course.objects.filter(user=user, deleted=False).order_by("-created_at")

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
        # Check if a course with this prompt already exists and is READY
        from .models import CourseGenerationContext
        existing_context = CourseGenerationContext.objects.filter(
            prompt=prompt, 
            course__level=level, 
            course__status="READY"
        ).first()

        if existing_context:
            existing_course = existing_context.course
            logger.info(f"Reusing existing course {existing_course.id} for prompt '{prompt}'")
            
            # Create new course for current user
            new_course = Course.objects.create(
                user=user,
                title=existing_course.title,
                desc=existing_course.desc,
                level=existing_course.level,
                thumb=existing_course.thumb,
                max_modules=existing_course.max_modules,
                status="READY"
            )

            # Duplicate Modules
            for module in existing_course.modules.all():
                new_module = Module.objects.create(
                    course=new_course,
                    name=module.name,
                    desc=module.desc,
                    created_at=module.created_at
                )

                # Duplicate Lessons
                for lesson in module.lessons.all():
                    new_lesson = Lesson.objects.create(
                        module=new_module,
                        title=lesson.title,
                        desc=lesson.desc,
                        duration=lesson.duration,
                        status="READY", # Ensure ready
                        lesson_file=lesson.lesson_file,
                        narration=lesson.narration,
                        key_points=lesson.key_points,
                        scene_suggestion=lesson.scene_suggestion,
                        created_at=lesson.created_at,
                        delivered=True # Since it's ready
                    )
                    
                    # Duplicate Quiz for Lesson if exists
                    if hasattr(lesson, 'quiz'):
                        original_quiz = lesson.quiz
                        new_quiz = Quiz.objects.create(
                            lesson=new_lesson,
                            title=original_quiz.title,
                            description=original_quiz.description
                        )
                        # Duplicate Questions
                        for question in original_quiz.questions.all():
                            new_question = Question.objects.create(
                                quiz=new_quiz,
                                text=question.text,
                                explanation=question.explanation
                            )
                            # Duplicate Choices
                            for choice in question.choices.all():
                                Choice.objects.create(
                                    question=new_question,
                                    text=choice.text,
                                    is_correct=choice.is_correct
                                )

                # Duplicate Quiz for Module if exists
                if hasattr(module, 'quiz'):
                    original_quiz = module.quiz
                    new_quiz = Quiz.objects.create(
                        module=new_module,
                        title=original_quiz.title,
                        description=original_quiz.description
                    )
                    # Duplicate Questions
                    for question in original_quiz.questions.all():
                        new_question = Question.objects.create(
                            quiz=new_quiz,
                            text=question.text,
                            explanation=question.explanation
                        )
                        # Duplicate Choices
                        for choice in question.choices.all():
                            Choice.objects.create(
                                question=new_question,
                                text=choice.text,
                                is_correct=choice.is_correct
                            )
            
            return new_course

        # If no existing course, create new one
        # If num_modules is None, default to 5, but task will update it
        course = Course.objects.create(user=user, level=level, max_modules=num_modules or 5)
        create_course_details.delay(course.pk, prompt, course.get_level_display())
        return course

    def delete_course(self, course_id: int, user):
        try:
            course = Course.objects.get(pk=course_id, user=user)
            course.deleted = True
            course.save(update_fields=["deleted"])
            return {"success": True}
        except Course.DoesNotExist:
            raise HttpError(404, "Curso não encontrado ou sem permissão")

    def get_next_lesson(self, user, course_id: int, current_lesson: int = 0):
        if current_lesson:
            return (
                Lesson.objects.filter(module__course_id=course_id)
                .only("module", "id", "status")
                .order_by("module__created_at", "id")
                .filter(id__gt=current_lesson)
                .first()
            )
        return (
            Lesson.objects.filter(
                module__course__user=user, module__course_id=course_id, watched=False
            )
            .only("module", "id", "status")
            .order_by("module__created_at", "module__id", "id")
            .first()
        )

    def get_quiz(self, lesson_id: int) -> Quiz:
        try:
            return Quiz.objects.get(lesson_id=lesson_id)
        except Quiz.DoesNotExist:
            raise HttpError(404, "Quiz ainda não disponível")

    def get_module_quiz(self, module_id: int) -> Quiz:
        try:
            return Quiz.objects.get(module_id=module_id)
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
        try:
            course = Course.objects.get(pk=course_id)
            current_module_count = course.modules.count()
            
            if course.max_modules and current_module_count >= course.max_modules:
                raise HttpError(400, f"Limite de módulos atingido ({course.max_modules})")

            # Check if the previous module's quiz is passed
            last_module = course.modules.order_by("id").last()
            if last_module:
                try:
                    # Assuming simple check: did the user pass *any* attempt for this quiz?
                    quiz = last_module.quiz
                    if quiz:
                        passed = QuizAttempt.objects.filter(
                            user_id=user_pk, quiz=quiz, passed=True
                        ).exists()
                        if not passed:
                            raise HttpError(400, "Você precisa passar no quiz do módulo anterior para avançar.")
                except Quiz.DoesNotExist:
                    pass # No quiz for previous module, allow proceed (or maybe generate one?)
            
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
        course = Course.objects.get(pk=course_id, user=user)
        
        # Verify completion
        if not course.is_fully_completed:
            raise HttpError(400, "O curso ainda não foi totalmente concluído.")

        # If READY, return the URL
        if course.certificate_status == "READY" and course.certificate_file:
            return {
                "status": "READY",
                "message": "Certificado pronto.",
                "certificate_url": f"{settings.MEDIA_URL}{course.certificate_file}"
            }

        # If PROCESSING, just return status
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
        return Lesson.objects.filter(id=lesson_id, module__course__user=user).first()

    def mark_watched(self, user, lesson_id: int):
        try:
            lesson = Lesson.objects.get(id=lesson_id, module__course__user=user)
            if not lesson.watched:
                lesson.watched = True
                lesson.save(update_fields=["watched"])
                return {"success": True}
            return {"error": "Já foi assistida"}
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
