from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class CourseStatus(models.TextChoices):
    PROCESSING = "PROCESSING", "Processando"
    READY = "READY", "Pronto"
    FAILED = "FAILED", "Falhou"


class LessonStatus(models.TextChoices):
    PENDING = "PENDING", "Pendente"
    PROCESSING = "PROCESSING", "Processando"
    READY = "READY", "Pronto"
    ERROR = "ERROR", "Erro"


class CourseLevel(models.TextChoices):
    BEGINNER = "B", "Beginner"
    INTERMEDIATE = "IT", "Intermediate"
    ADVANCED = "A", "Advance"


class Course(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="courses",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=80, null=True, blank=True)
    desc = models.TextField(null=True, blank=True)
    level = models.CharField(
        max_length=2, choices=CourseLevel.choices, null=True, blank=True
    )
    status = models.CharField(
        max_length=20,
        choices=CourseStatus.choices,
        default=CourseStatus.PROCESSING,
    )
    thumb = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Module(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    name = models.CharField(max_length=150, null=True, blank=True)
    desc = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)


class Lesson(models.Model):
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=150)
    desc = models.TextField()
    duration = models.PositiveIntegerField(default=0)
    watched = models.BooleanField(default=False)
    status = models.CharField(
        max_length=20,
        choices=LessonStatus.choices,
        default=LessonStatus.PENDING,
    )
    lesson_file = models.CharField(max_length=150, null=True, blank=True)
    narration = models.TextField(null=True, blank=True)
    key_points = models.CharField(max_length=150, null=True, blank=True)
    scene_suggestion = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)


class CourseGenerationContext(models.Model):
    course = models.OneToOneField(
        Course, on_delete=models.CASCADE, related_name="generation_context"
    )
    system_prompt = models.TextField()
    prompt = models.TextField(null=True, blank=True)
    response = models.TextField(null=True, blank=True)
    current_module_index = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Quiz(models.Model):
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name="quizzes", null=True, blank=True
    )
    lesson = models.OneToOneField(
        Lesson, on_delete=models.CASCADE, related_name="quiz", null=True, blank=True
    )
    title = models.CharField(max_length=150)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Question(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="questions")
    text = models.CharField(max_length=500)
    explanation = models.TextField(
        null=True, blank=True, help_text="Explanation for the correct answer"
    )


class Choice(models.Model):
    question = models.ForeignKey(
        Question, on_delete=models.CASCADE, related_name="choices"
    )
    text = models.CharField(max_length=200)
    is_correct = models.BooleanField(default=False)


class QuizAttempt(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="quiz_attempts")
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="attempts")
    score = models.FloatField()
    passed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(auto_now_add=True)
