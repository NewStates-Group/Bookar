from django.contrib.auth import get_user_model
from django.db import models
from cloudinary_storage.storage import VideoMediaCloudinaryStorage, RawMediaCloudinaryStorage, MediaCloudinaryStorage

User = get_user_model()


class CourseStatus(models.TextChoices):
    PROCESSING = "PROCESSING", "Processando"
    READY = "READY", "Pronto"
    FAILED = "FAILED", "Falhou"
    CANCELLED = "CANCELLED", "Cancelado"


class CertificateStatus(models.TextChoices):
    NOT_GENERATED = "NOT_GENERATED", "Não Gerado"
    PROCESSING = "PROCESSING", "Processando"
    READY = "READY", "Pronto"


class LessonStatus(models.TextChoices):
    PENDING = "PENDING", "Pendente"
    PROCESSING = "PROCESSING", "Processando"
    READY = "READY", "Pronto"
    ERROR = "ERROR", "Erro"
    CANCELLED = "CANCELLED", "Cancelado"


class ModuleStatus(models.TextChoices):
    PROCESSING = "PROCESSING", "Processando"
    READY = "READY", "Pronto"
    FAILED = "FAILED", "Falhou"
    CANCELLED = "CANCELLED", "Cancelado"


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
    thumb = models.ImageField(upload_to="courses/thumbs/", null=True, blank=True, storage=MediaCloudinaryStorage())
    deleted = models.BooleanField(default=False, null=True, blank=True)
    max_modules = models.PositiveIntegerField(null=True, blank=True, default=5)
    
    certificate_file = models.FileField(upload_to="courses/certificates/", null=True, blank=True, storage=RawMediaCloudinaryStorage())
    certificate_status = models.CharField(
        max_length=20,
        choices=CertificateStatus.choices,
        default=CertificateStatus.NOT_GENERATED,
    )
    
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_completed(self):
        # Check if all lessons are watched
        total_lessons = Lesson.objects.filter(module__course=self).count()
        if total_lessons == 0:
            return False
        watched_lessons = Lesson.objects.filter(module__course=self, watched=True).count()
        if watched_lessons < total_lessons:
            return False

        # Check quizzes
        for module in self.modules.all():
            if hasattr(module, 'quiz'):
                # We need to import QuizAttempt inside method to avoid circular import if define elsewhere
                # But models.py defines all. We need to make sure QuizAttempt is available or use strict relation
                # QuizAttempt is defined below. Python resolves at runtime, so it should be fine if defined in same file.
                # However, QuizAttempt is usually defined AFTER Course.
                # Use string reference or import locally?
                # Actually, QuizAttempt is defined in same file, likely below. 
                # Let's check where QuizAttempt is defined.
                pass
        
        # Re-implementing with lookup that doesn't depend on order if possible, or just moving class?
        # Better: use reverse relation if available.
        # QuizAttempt has 'quiz' FK.
        # Quiz has 'module' OneToOne.
        # So module.quiz.attempts.filter(user=self.user, passed=True).exists()
        
        # But wait, Course.user is the owner.
        return self._check_completion()

    def _check_completion(self):
        # We use runtime lookup because QuizAttempt is defined below
        for module in self.modules.all():
            if hasattr(module, 'quiz'):
                # Check if passed attempt exists
                if not module.quiz.attempts.filter(passed=True).exists():
                    return False
        return True

    @property
    def is_fully_completed(self):
        """
        Comprehensive completion check:
        - All modules generated (reached max_modules)
        - All lessons in all modules are watched
        - All module quizzes are passed
        """
        # 1. Check if all modules are generated
        if self.max_modules and self.modules.count() < self.max_modules:
            return False
        
        # 2. Check if all lessons are watched and ready
        total_lessons = Lesson.objects.filter(module__course=self).count()
        if total_lessons == 0:
            return False
            
        watched_lessons = Lesson.objects.filter(module__course=self, watched=True, status="READY").count()
        if watched_lessons < total_lessons:
            return False
            
        # 3. Check if all module quizzes are passed
        for module in self.modules.all():
            if hasattr(module, 'quiz'):
                if not module.quiz.attempts.filter(passed=True).exists():
                    return False
        
        return True


class Module(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    name = models.CharField(max_length=150, null=True, blank=True)
    desc = models.TextField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=ModuleStatus.choices,
        default=ModuleStatus.READY,
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)


class Lesson(models.Model):
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=150)
    desc = models.TextField()
    duration = models.PositiveIntegerField(default=0)
    watched = models.BooleanField(default=False)
    delivered = models.BooleanField(default=False, null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=LessonStatus.choices,
        default=LessonStatus.PENDING,
    )
    lesson_file = models.FileField(upload_to="courses/lessons/", null=True, blank=True, storage=VideoMediaCloudinaryStorage())
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
    module = models.OneToOneField(
        Module, on_delete=models.CASCADE, related_name="quiz", null=True, blank=True
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
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="quiz_attempts"
    )
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="attempts")
    score = models.FloatField()
    passed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(auto_now_add=True)
