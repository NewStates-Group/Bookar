import os
import django
import sys

# Setup Django environment
sys.path.append("/home/kiluzx/Documents/Bookar/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from courses.models import Course, Module, Lesson, Quiz, QuizAttempt, Question, Choice
from courses.services import CourseService
from django.contrib.auth import get_user_model

User = get_user_model()

def test_quiz_flow():
    print("Starting Quiz Flow Verification...")
    
    # 1. Setup User and Course
    user, _ = User.objects.get_or_create(username="testuser_quiz", email="quiz@test.com")
    course = Course.objects.create(user=user, title="Quiz Test Course", max_modules=1)
    print(f"Course created: {course.title}")

    # 2. Create Module and Lesson
    module = Module.objects.create(course=course, name="Test Module 1")
    lesson = Lesson.objects.create(
        module=module, 
        title="Test Lesson", 
        desc="Description", 
        status="READY", 
        watched=True # Simulate watched
    )
    print(f"Module and Lesson created. Lesson watched: {lesson.watched}")

    # 3. Create Quiz
    quiz = Quiz.objects.create(module=module, course=course, title="Module Quiz")
    question = Question.objects.create(quiz=quiz, text="What is 2+2?")
    choice_correct = Choice.objects.create(question=question, text="4", is_correct=True)
    choice_wrong = Choice.objects.create(question=question, text="5", is_correct=False)
    print("Quiz created.")

    # 4. Check Course Completion (Should be False because no passed attempt)
    print(f"Is course completed? {course.is_completed}")
    assert course.is_completed == False, "Course should not be completed yet"

    # 5. Attempt Quiz (Fail)
    QuizAttempt.objects.create(user=user, quiz=quiz, score=0, passed=False)
    print(f"Failed attempt recorded. Is completed? {course.is_completed}")
    assert course.is_completed == False

    # 6. Attempt Quiz (Pass)
    QuizAttempt.objects.create(user=user, quiz=quiz, score=10, passed=True)
    print(f"Passed attempt recorded. Is completed? {course.is_completed}")
    assert course.is_completed == True, "Course should be completed now"

    # 7. Generate Certificate
    service = CourseService()
    pdf_buffer = service.generate_certificate(user, course.id)
    print(f"Certificate generated. Size: {pdf_buffer.getbuffer().nbytes} bytes")
    assert pdf_buffer.getbuffer().nbytes > 0

    print("Verification Successful!")

if __name__ == "__main__":
    try:
        test_quiz_flow()
    except Exception as e:
        print(f"Verification Failed: {e}")
        import traceback
        traceback.print_exc()
