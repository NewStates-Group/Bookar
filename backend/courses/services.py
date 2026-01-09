import logging

from django.db.models.query import QuerySet
from ninja.errors import HttpError

from .utils import get_next_lesson
from .models import Course, Lesson, Quiz, Question, Choice, QuizAttempt
from .tasks import create_course_description, create_course_thumb, generate_lesson, generate_next_module

logger = logging.getLogger(__name__)


class CourseService:
    def list_courses(self, user) -> QuerySet[Course]:
        return Course.objects.filter(user=user).order_by("-created_at")

    def get_course(self, id: int) -> Course:
        try:
            course = Course.objects.prefetch_related("modules__lessons").get(pk=id)
            return course
        except Course.DoesNotExist:
            raise HttpError(404, "Curso não encontrado")

    def create_course(self, user, title: str, details: str, level: str) -> Course:
        course = Course.objects.create(user=user, title=title, level=level)
        create_course_description.delay(
            course.pk, title, details, course.get_level_display()
        )
        create_course_thumb.delay(course.pk, title)
        return course

    def delete_course(self, course_id: int, user):
        try:
            course = Course.objects.get(pk=course_id, user=user)
            course.delete()  # Cascade will delete modules, lessons, quizzes
            return {"success": True, "message": "Curso excluído com sucesso"}
        except Course.DoesNotExist:
            raise HttpError(404, "Curso não encontrado ou sem permissão")


    def get_lesson(self, course_id: int) -> Lesson:
        lesson = get_next_lesson(course_id)
        if not lesson:
             raise HttpError(404, "Não há mais lições no curso")
             
        # If the lesson is still pending, trigger its generation
        if lesson.status == "PENDING":
            generate_lesson.delay(lesson.id)
            
        return lesson

    def mark_watched(self, lesson_id: int):
        try:
            lesson = Lesson.objects.get(id=lesson_id)
            lesson.watched = True
            lesson.save()
            
            # Trigger generation of next lesson after this one is marked watched
            course_id = lesson.module.course_id
            next_lesson = get_next_lesson(course_id)
            if next_lesson and next_lesson.status == "PENDING":
                generate_lesson.delay(next_lesson.id)
                
            return {"success": True}
        except Lesson.DoesNotExist:
            raise HttpError(404, "Lição não encontrada")

    def get_quiz(self, lesson_id: int) -> Quiz:
        try:
            return Quiz.objects.get(lesson_id=lesson_id)
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
                
        # Find correct choices for unanswered questions too? Or just return what was sent?
        # Simpler: just return correct choice IDs for all questions in the quiz.
        all_correct = Choice.objects.filter(question__quiz=quiz, is_correct=True).values_list('id', flat=True)
        
        score = (correct_count / total_questions) * 10.0
        passed = score >= 7.0
        
        QuizAttempt.objects.create(
            user=user,
            quiz=quiz,
            score=score,
            passed=passed
        )
        
        return {
            "score": score,
            "passed": passed,
            "correct_answers": list(all_correct)
        }

    def trigger_next_module(self, course_id: int):
        generate_next_module.delay(course_id)
        return {"success": True, "message": "Gerando módulo..."}

