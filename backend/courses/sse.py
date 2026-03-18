import asyncio
import json
from django.http import StreamingHttpResponse
from django.views.decorators.http import require_http_methods
from asgiref.sync import sync_to_async
from .models import Course, Lesson
from .schemas import CourseDetailSchema
from django.core.serializers.json import DjangoJSONEncoder
from django.contrib.auth import get_user_model
from ninja_jwt.tokens import AccessToken

User = get_user_model()


def get_user_from_token(token_str):
    """Validate token and return user"""
    try:
        token = AccessToken(token_str)
        user_id = token.payload.get('user_id')
        return User.objects.get(pk=user_id)
    except Exception:
        return None


async def course_sse_stream(request, course_id):
    """SSE endpoint for real-time course updates"""
    
    # Authenticate via token query param
    token = request.GET.get('token')
    user = await sync_to_async(get_user_from_token)(token)
    
    if not user:
        return StreamingHttpResponse(
            iter([f"data: {json.dumps({'error': 'Unauthorized'})}\n\n"]),
            content_type='text/event-stream',
            status=401
        )
    
    async def event_generator():
        last_data = None
        
        while True:
            try:
                # Fetch course data
                course = await sync_to_async(
                    lambda: Course.objects.prefetch_related(
                        'modules__lessons'
                    ).get(pk=course_id, enrollments__user=user, enrollments__deleted=False)
                )()
                
                # Serialize to dict
                course_dict = await sync_to_async(
                    lambda: {
                        'id': course.id,
                        'title': course.title,
                        'desc': course.desc,
                        'status': course.status,
                        'modules': [
                            {
                                'id': m.id,
                                'name': m.name,
                                'desc': m.desc,
                                'lessons': [
                                    {
                                        'id': l.id,
                                        'title': l.title,
                                        'desc': l.desc,
                                        'status': l.status,
                                        'duration': l.duration,
                                    }
                                    for l in m.lessons.all()
                                ]
                            }
                            for m in course.modules.all()
                        ]
                    }
                )()
                
                # Only send if data changed
                current_data = json.dumps(course_dict, cls=DjangoJSONEncoder)
                if current_data != last_data:
                    yield f"data: {current_data}\n\n"
                    last_data = current_data
                
                await asyncio.sleep(2)  # Check every 2 seconds
                
            except Course.DoesNotExist:
                yield f"data: {json.dumps({'error': 'Course not found'})}\n\n"
                break
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                await asyncio.sleep(2)
    
    response = StreamingHttpResponse(
        event_generator(),
        content_type='text/event-stream'
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response


async def lesson_sse_stream(request, lesson_id):
    """SSE endpoint for real-time lesson updates"""
    
    # Authenticate via token query param
    token = request.GET.get('token')
    user = await sync_to_async(get_user_from_token)(token)
    
    if not user:
        return StreamingHttpResponse(
            iter([f"data: {json.dumps({'error': 'Unauthorized'})}\n\n"]),
            content_type='text/event-stream',
            status=401
        )
    
    async def event_generator():
        last_status = None
        
        while True:
            try:
                lesson = await sync_to_async(
                    lambda: Lesson.objects.select_related('module__course').get(
                        pk=lesson_id,
                        module__course__enrollments__user=user,
                        module__course__enrollments__deleted=False
                    )
                )()
                
                lesson_dict = {
                    'id': lesson.id,
                    'title': lesson.title,
                    'desc': lesson.desc,
                    'status': lesson.status,
                    'delivered': lesson.delivered,
                    'lesson_file': lesson.lesson_file,
                    'duration': lesson.duration,
                }
                
                # Only send if status changed
                if lesson.status != last_status:
                    yield f"data: {json.dumps(lesson_dict)}\n\n"
                    last_status = lesson.status
                
                # Stop polling if lesson is ready or error
                if lesson.status in ['READY', 'ERROR']:
                    break
                    
                await asyncio.sleep(2)
                
            except Lesson.DoesNotExist:
                yield f"data: {json.dumps({'error': 'Lesson not found'})}\n\n"
                break
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                await asyncio.sleep(2)
    
    response = StreamingHttpResponse(
        event_generator(),
        content_type='text/event-stream'
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response
