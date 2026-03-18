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
    max_modules = models.PositiveIntegerField(null=True, blank=True, default=5)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def creator(self):
        # find the creator as the first user enrolled
        enrollment = self.enrollments.order_by("enrolled_at").first()
        return enrollment.user if enrollment else None

    def is_completed(self, user):
        # Check if all lessons are watched for this specific user
        total_lessons = Lesson.objects.filter(module__course=self).count()
        if total_lessons == 0:
            return False
        watched_lessons = LessonProgress.objects.filter(
            lesson__module__course=self, user=user, watched=True
        ).count()
        if watched_lessons < total_lessons:
            return False

        return self._check_completion(user)

    def _check_completion(self, user):
        for module in self.modules.all():
            if hasattr(module, "quiz"):
                if not module.quiz.attempts.filter(user=user, passed=True).exists():
                    return False
        return True

    def is_fully_completed(self, user):
        """
        Comprehensive completion check:
        - All modules generated (reached max_modules)
        - All lessons in all modules are watched by the user
        - All module quizzes are passed by the user
        """
        if self.max_modules and self.modules.count() < self.max_modules:
            return False

        total_lessons = Lesson.objects.filter(module__course=self).count()
        if total_lessons == 0:
            return False

        watched_lessons = LessonProgress.objects.filter(
            lesson__module__course=self, user=user, watched=True, lesson__status="READY"
        ).count()
        if watched_lessons < total_lessons:
            return False

        for module in self.modules.all():
            if hasattr(module, "quiz"):
                if not module.quiz.attempts.filter(user=user, passed=True).exists():
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


class LessonProgress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="lesson_progress")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="progress")
    watched = models.BooleanField(default=False)
    watched_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "lesson")


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


class EnrollmentStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Ativo"
    PAUSED = "PAUSED", "Pausado"
    FINISHED = "FINISHED", "Concluído"


class CourseEnrollment(models.Model):
    """
    Links a Course to a User (for course reuse / sharing).
    The course owner is still tracked by Course.user.
    """
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name="enrollments"
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="enrollments"
    )
    status = models.CharField(
        max_length=20,
        choices=EnrollmentStatus.choices,
        default=EnrollmentStatus.ACTIVE,
    )
    deleted = models.BooleanField(default=False)
    certificate_file = models.FileField(
        upload_to="courses/certificates/",
        null=True,
        blank=True,
        storage=MediaCloudinaryStorage(),
    )
    certificate_status = models.CharField(
        max_length=20,
        choices=CertificateStatus.choices,
        default=CertificateStatus.NOT_GENERATED,
    )
    enrolled_at = models.DateTimeField(auto_now_add=True)
    last_accessed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        unique_together = ("course", "user")

    def __str__(self):
        return f"Enrollment: {self.user} → {self.course}"
