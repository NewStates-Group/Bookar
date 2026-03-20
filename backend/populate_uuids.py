import uuid
import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from courses.models import Course, Module, Lesson, generate_short_id

print("Populating Course UUIDs...")
for c in Course.objects.filter(uuid__isnull=True):
    c.uuid = uuid.uuid4()
    c.save(update_fields=['uuid'])
    print(f"Course {c.id} -> {c.uuid}")

print("Populating Module UUIDs...")
for m in Module.objects.filter(uuid__isnull=True):
    m.uuid = uuid.uuid4()
    m.save(update_fields=['uuid'])
    print(f"Module {m.id} -> {m.uuid}")

print("Populating Lesson Short IDs...")
for l in Lesson.objects.filter(short_id__isnull=True):
    l.short_id = generate_short_id()
    l.save(update_fields=['short_id'])
    print(f"Lesson {l.id} -> {l.short_id}")

print("Done.")
