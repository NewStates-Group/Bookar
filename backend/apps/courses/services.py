import logging
import uuid
from collections import defaultdict

from asgiref.sync import sync_to_async
from django.core.cache import cache
from django.db.models import Count, Prefetch
from django.utils import timezone
from ninja.errors import HttpError
from utils.websocket import send_user_update

from apps.subscriptions.services import SubscriptionService

from .models import (
    Course,
    CourseEnrollment,
    CourseShare,
    CourseShareClaim,
    Lesson,
    LessonProgress,
    Module,
    Quiz,
    QuizAttempt,
)
from .tasks import (
    create_course_details,
    generate_certificate_task,
    generate_lesson_plan,
    generate_next_module,
)
from .utils import (
    get_course_detail_cache_key,
    get_course_list_cache_key,
    get_lesson_detail_cache_key,
    invalidate_course_cache,
)

logger = logging.getLogger(__name__)


class CourseService:
    async def _batch_compute_completions(self, user, course_ids: list[int]) -> dict[int, dict]:
        course_ids = [cid for cid in course_ids if cid]

        lesson_counts = await sync_to_async(
            lambda: dict(
                Lesson.objects.filter(module__course_id__in=course_ids)
                .values("module__course_id").annotate(count=Count("id"))
                .values_list("module__course_id", "count")
            )
        )()

        watched_counts = await sync_to_async(
            lambda: dict(
                LessonProgress.objects.filter(
                    user=user, lesson__module__course_id__in=course_ids, watched=True
                ).values("lesson__module__course_id").annotate(count=Count("id"))
                .values_list("lesson__module__course_id", "count")
            )
        )()

        ready_lesson_counts = await sync_to_async(
            lambda: dict(
                Lesson.objects.filter(module__course_id__in=course_ids, status="READY")
                .values("module__course_id").annotate(count=Count("id"))
                .values_list("module__course_id", "count")
            )
        )()

        watched_ready = await sync_to_async(
            lambda: dict(
                LessonProgress.objects.filter(
                    user=user, lesson__module__course_id__in=course_ids,
                    lesson__status="READY", watched=True,
                ).values("lesson__module__course_id").annotate(count=Count("id"))
                .values_list("lesson__module__course_id", "count")
            )
        )()

        module_counts = await sync_to_async(
            lambda: dict(
                Module.objects.filter(course_id__in=course_ids)
                .values("course_id").annotate(count=Count("id"))
                .values_list("course_id", "count")
            )
        )()

        max_mod_map = await sync_to_async(
            lambda: dict(
                Course.objects.filter(id__in=course_ids).values_list("id", "max_modules")
            )
        )()

        course_quiz_map_raw = await sync_to_async(
            lambda: list(
                Quiz.objects.filter(module__course_id__in=course_ids)
                .values_list("id", "module__course_id")
            )
        )()
        course_quiz_map: dict[int, list[int]] = defaultdict(list)
        for qid, cid in course_quiz_map_raw:
            course_quiz_map[cid].append(qid)

        all_quiz_ids = [qid for ids in course_quiz_map.values() for qid in ids]
        passed_set: set[int] = set()
        if all_quiz_ids:
            passed_set = set(
                await sync_to_async(
                    lambda: list(
                        QuizAttempt.objects.filter(
                            quiz_id__in=all_quiz_ids, user=user, passed=True
                        ).values_list("quiz_id", flat=True)
                    )
                )()
            )

        result = {}
        for cid in course_ids:
            total_lessons = lesson_counts.get(cid, 0)
            watched = watched_counts.get(cid, 0)
            ready_total = ready_lesson_counts.get(cid, 0)
            watched_ready_count = watched_ready.get(cid, 0)
            total_modules = module_counts.get(cid, 0)
            max_mod = max_mod_map.get(cid, 0)
            quiz_ids = course_quiz_map.get(cid, [])
            passed_quizzes = sum(1 for qid in quiz_ids if qid in passed_set)
            quizzes_ok = len(quiz_ids) == passed_quizzes
            lessons_ok = total_lessons > 0 and watched >= total_lessons
            is_completed = lessons_ok and quizzes_ok
            ready_ok = (
                (not max_mod or total_modules >= max_mod)
                and ready_total > 0 and watched_ready_count >= ready_total
            )
            is_fully_completed = ready_ok and quizzes_ok
            result[cid] = {"is_completed": is_completed, "is_fully_completed": is_fully_completed}
        return result

    async def list_courses(self, user) -> list:
        cache_key = get_course_list_cache_key(user.id)
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        enrollments = await sync_to_async(
            lambda: list(
                CourseEnrollment.objects.filter(user=user, deleted=False)
                .select_related("course")
                .only(
                    "course__uuid", "course__title", "course__desc", "course__thumb",
                    "course__level", "course__status", "course__max_modules",
                    "course__created_at", "course__owner_id",
                    "certificate_status", "certificate_file",
                )
                .order_by("-course__created_at")
            )
        )()

        if not enrollments:
            return []

        course_ids = [e.course_id for e in enrollments]
        completion_data = await self._batch_compute_completions(user, course_ids)

        for e in enrollments:
            c = e.course
            data = completion_data.get(c.id, {})
            c._precomputed_is_completed = data.get("is_completed", False)
            c._precomputed_is_fully_completed = data.get("is_fully_completed", False)
            c._precomputed_certificate_status = e.certificate_status
            try:
                c._precomputed_certificate_url = (
                    e.certificate_file.url
                    if e.certificate_status == "READY" and e.certificate_file
                    else None
                )
            except Exception:
                c._precomputed_certificate_url = None

        courses = [e.course for e in enrollments]
        cache.set(cache_key, courses, 300)
        return courses

    async def get_course(self, id: str, user=None) -> Course:
        cache_key = get_course_detail_cache_key(id)
        course = cache.get(cache_key)

        if not course:
            from .models import ModuleMaterial

            try:
                course = await sync_to_async(
                    Course.objects.select_related("owner")
                    .only(
                        "uuid", "title", "desc", "level", "status",
                        "max_modules", "created_at", "owner", "thumb",
                    )
                    .prefetch_related(
                        Prefetch(
                            "modules",
                            queryset=Module.objects.order_by("created_at")
                            .prefetch_related(
                                Prefetch("lessons", queryset=Lesson.objects.order_by("id")),
                                Prefetch(
                                    "quiz",
                                    queryset=Quiz.objects.prefetch_related(
                                        Prefetch(
                                            "attempts",
                                            queryset=QuizAttempt.objects.none(),
                                            to_attr="_prefetched_attempts",
                                        )
                                    ),
                                ),
                                "material",
                            ),
                        ),
                    )
                    .get
                )(uuid=id)
                cache.set(cache_key, course, 600)
            except Course.DoesNotExist:
                raise HttpError(404, "Curso não encontrado")

        if user:
            await sync_to_async(
                CourseEnrollment.objects.filter(course=course, user=user).update
            )(last_accessed_at=timezone.now())

            module_ids = [m.id for m in course.modules.all()]
            quiz_ids = await sync_to_async(
                lambda: list(
                    Quiz.objects.filter(module_id__in=module_ids).values_list("id", flat=True)
                )
            )()
            if quiz_ids:
                attempts = await sync_to_async(
                    lambda: list(
                        QuizAttempt.objects.filter(
                            quiz_id__in=quiz_ids, user=user
                        ).order_by("quiz_id", "-completed_at")
                    )
                )()
                best: dict[int, QuizAttempt] = {}
                for a in attempts:
                    if a.quiz_id not in best:
                        best[a.quiz_id] = a
                for module in course.modules.all():
                    if hasattr(module, "quiz") and module.quiz:
                        attempt = best.get(module.quiz.id)
                        if attempt:
                            module._last_quiz_score = attempt.score
                            module._last_quiz_passed = attempt.passed

            completion = (await self._batch_compute_completions(user, [course.id])).get(course.id, {})
            course._precomputed_is_completed = completion.get("is_completed", False)
            course._precomputed_is_fully_completed = completion.get("is_fully_completed", False)

            enrollment = await sync_to_async(
                CourseEnrollment.objects.filter(course=course, user=user)
                .only("certificate_status", "certificate_file").first
            )()
            if enrollment:
                course._precomputed_certificate_status = enrollment.certificate_status
                try:
                    course._precomputed_certificate_url = (
                        enrollment.certificate_file.url
                        if enrollment.certificate_status == "READY" and enrollment.certificate_file
                        else None
                    )
                except Exception:
                    course._precomputed_certificate_url = None

        return course

    async def create_course(self, user, prompt: str, level: str, num_modules: int = None) -> Course:
        user_enrollment = await sync_to_async(
            CourseEnrollment.objects.filter(
                user=user, course__level=level,
                course__generation_context__prompt=prompt, deleted=False,
            ).first
        )()

        if user_enrollment:
            return user_enrollment.course

        from .models import CourseGenerationContext

        existing_context = await sync_to_async(
            CourseGenerationContext.objects.filter(
                prompt=prompt, course__level=level, course__status="READY"
            ).order_by("-created_at").first
        )()

        if existing_context:
            existing_course = existing_context.course
            await self.enroll_course(user, existing_course.id)
            return existing_course

        await SubscriptionService().check_and_increment(user, "course_generated")

        course = await sync_to_async(Course.objects.create)(
            level=level, max_modules=num_modules or 4, owner=user
        )
        await self.enroll_course(user, course.id)

        create_course_details.delay(user.id, course.pk, prompt, course.get_level_display())
        return course

    async def delete_course(self, course_id: str, user):
        try:
            enrollment = await sync_to_async(CourseEnrollment.objects.get)(
                course__uuid=course_id, user=user
            )
        except CourseEnrollment.DoesNotExist:
            raise HttpError(404, "Curso não encontrado ou sem permissão")
        enrollment.deleted = True
        await sync_to_async(enrollment.save)()
        cache.delete(get_course_list_cache_key(user.id))
        return {"success": True}

    async def enroll_course(self, user, course_id) -> CourseEnrollment:
        try:
            course = await sync_to_async(Course.objects.get)(id=course_id)
        except Course.DoesNotExist:
            raise HttpError(404, "Curso não encontrado")

        enrollment, created = await sync_to_async(CourseEnrollment.objects.get_or_create)(
            user=user, course=course
        )

        if not course.owner:
            course.owner = user
            await sync_to_async(course.save)(update_fields=["owner"])

        if enrollment.deleted:
            enrollment.deleted = False
            await sync_to_async(enrollment.save)()

        cache.delete(get_course_list_cache_key(user.id))
        return enrollment

    async def cancel_course(self, user, course_id: str):
        try:
            course = await sync_to_async(Course.objects.get)(uuid=course_id)
        except Course.DoesNotExist:
            raise HttpError(404, "Curso não encontrado")

        if course.creator == user:
            course.status = "CANCELLED"
            await sync_to_async(course.save)(update_fields=["status"])
            invalidate_course_cache(course_id, user.id)

        await sync_to_async(
            CourseEnrollment.objects.filter(course=course, user=user).update
        )(deleted=True)
        return {"success": True, "message": "Curso cancelado e removido."}

    async def get_next_lesson(self, user, course_id: str, current_lesson_id: str = "0"):
        if current_lesson_id != "0":
            return await sync_to_async(
                Lesson.objects.filter(module__course__uuid=course_id)
                .only("module", "id", "status")
                .order_by("module__created_at", "id")
                .filter(short_id__gt=current_lesson_id).first
            )()

        lessons = await sync_to_async(
            lambda: list(
                Lesson.objects.filter(module__course__uuid=course_id)
                .order_by("module__created_at", "module__id", "id")
                .only("id", "module", "status", "short_id", "title")
            )
        )()
        if not lessons:
            return None

        watched_ids = set(
            await sync_to_async(
                lambda: list(
                    LessonProgress.objects.filter(
                        user=user, lesson__in=lessons, watched=True
                    ).values_list("lesson_id", flat=True)
                )
            )()
        )

        for lesson in lessons:
            if lesson.id not in watched_ids:
                return lesson
        return None

    async def get_quiz(self, lesson_id: str) -> Quiz:
        try:
            return await sync_to_async(Quiz.objects.get)(lesson__short_id=lesson_id)
        except Quiz.DoesNotExist:
            raise HttpError(404, "Quiz ainda não disponível")

    async def get_module_quiz(self, user, module_id: str) -> Quiz:
        try:
            module = await sync_to_async(Module.objects.prefetch_related("lessons").get)(uuid=module_id)
        except Module.DoesNotExist:
            raise HttpError(404, "Módulo não encontrado")

        total_lessons = await sync_to_async(module.lessons.count)()
        watched_count = await sync_to_async(
            LessonProgress.objects.filter(lesson__module=module, user=user, watched=True).count
        )()
        if watched_count < total_lessons:
            raise HttpError(
                400, "Você precisa assistir a todas as aulas antes de iniciar o quiz.",
            )
        try:
            return await sync_to_async(Quiz.objects.get)(module__uuid=module_id)
        except Quiz.DoesNotExist:
            raise HttpError(404, "Quiz ainda não disponível")

    async def submit_quiz(self, user, quiz_id: str, answers: list) -> dict:
        try:
            quiz = await sync_to_async(Quiz.objects.get)(uuid=quiz_id)
        except Quiz.DoesNotExist:
            raise HttpError(404, "Quiz não encontrado")

        total_questions = await sync_to_async(quiz.questions.count)()
        if total_questions == 0:
            return {"score": 100, "passed": True, "correct_answers": []}

        questions = await sync_to_async(
            lambda: list(quiz.questions.prefetch_related("choices").all())
        )()
        question_map = {str(q.uuid): q for q in questions}
        all_correct_map: dict[str, str] = {}
        for q in questions:
            for c in q.choices.all():
                if c.is_correct:
                    all_correct_map[str(q.uuid)] = str(c.uuid)
                    break

        correct_count = 0
        correct_choice_ids = []
        for ans in answers:
            q_uuid = ans.question_id
            c_uuid = ans.choice_id
            question = question_map.get(q_uuid)
            if not question:
                continue
            choice_ids = [str(c.uuid) for c in question.choices.all()]
            if c_uuid not in choice_ids:
                continue
            if c_uuid == all_correct_map.get(q_uuid):
                correct_count += 1
                correct_choice_ids.append(c_uuid)
            else:
                correct_uuid = all_correct_map.get(q_uuid)
                if correct_uuid:
                    correct_choice_ids.append(correct_uuid)

        all_correct = list(all_correct_map.values())
        score = (correct_count / total_questions) * 10.0
        passed = score >= 7.0

        await sync_to_async(QuizAttempt.objects.create)(
            user=user, quiz=quiz, score=score, passed=passed
        )

        return {"score": score, "passed": passed, "correct_answers": [str(u) for u in all_correct]}

    async def trigger_next_module(self, user_pk, course_id: str):
        try:
            course = await sync_to_async(Course.objects.get)(uuid=course_id)
        except Course.DoesNotExist:
            raise HttpError(404, "Curso não encontrado")

        current_module_count = await sync_to_async(course.modules.count)()
        if course.max_modules and current_module_count >= course.max_modules:
            raise HttpError(400, f"Limite de módulos atingido ({course.max_modules})")

        last_module = await sync_to_async(course.modules.order_by("id").last)()
        if last_module:
            total_lessons = await sync_to_async(last_module.lessons.count)()
            watched_count = await sync_to_async(
                LessonProgress.objects.filter(
                    lesson__module=last_module, user=user_pk, watched=True
                ).count
            )()
            if watched_count < total_lessons:
                raise HttpError(
                    400, "Você precisa assistir a todas as aulas do módulo anterior para avançar.",
                )
            try:
                quiz = last_module.quiz
                if quiz:
                    passed = await sync_to_async(
                        QuizAttempt.objects.filter(user=user_pk, quiz=quiz, passed=True).exists
                    )()
                    if not passed:
                        raise HttpError(
                            400, "Você precisa passar no quiz do módulo anterior para avançar.",
                        )
            except Quiz.DoesNotExist:
                pass

        new_module = await sync_to_async(Module.objects.create)(
            course=course, name="Gerando módulo...", status="PROCESSING"
        )

        generate_next_module.delay(user_pk, course_id, new_module.pk)
        await send_user_update(
            user_pk,
            {
                "type": "module_update",
                "course_id": course_id,
                "id": str(new_module.uuid),
                "status": "PROCESSING",
                "name": new_module.name,
            },
        )
        return {"success": True, "message": "Gerando módulo...", "module_id": new_module.pk}

    async def get_certificate_info(self, user, course_id: str):
        course = await sync_to_async(Course.objects.get)(uuid=course_id)
        enrollment = await sync_to_async(CourseEnrollment.objects.get)(course=course, user=user)

        if not course.is_fully_completed(user):
            raise HttpError(400, "O curso ainda não foi totalmente concluído.")

        if enrollment.certificate_status == "READY":
            return {"status": "READY", "certificate_url": enrollment.certificate_file.url}

        if enrollment.certificate_status == "PROCESSING":
            return {"status": "PROCESSING", "message": "Seu certificado está sendo gerado."}

        full_name = f"{user.first_name} {user.last_name}".strip() or user.username
        enrollment.certificate_status = "PROCESSING"
        await sync_to_async(enrollment.save)()
        generate_certificate_task.delay(user.id, course.id, full_name)
        return {
            "status": "PROCESSING",
            "message": "Certificado está a ser gerado. Enviaremos um e-mail brevemente.",
        }

    async def generate_share_token(self, user, course_id: str) -> CourseShare:
        try:
            course = await sync_to_async(Course.objects.get)(uuid=course_id)
        except Course.DoesNotExist:
            raise HttpError(404, "Curso não encontrado")

        enrolled = await sync_to_async(
            CourseEnrollment.objects.filter(course=course, user=user).exists
        )()
        if not enrolled:
            raise HttpError(403, "Sem permissão para partilhar este curso")

        share, created = await sync_to_async(CourseShare.objects.get_or_create)(
            course=course, sharer=user, defaults={"token": str(uuid.uuid4())}
        )
        return await self.get_share_info(share.token)

    async def get_share_info(self, token: str) -> dict:
        try:
            share = await sync_to_async(
                CourseShare.objects.select_related("course", "sharer").get
            )(token=token)
            return {
                "token": share.token,
                "course_id": str(share.course.uuid),
                "course_title": share.course.title,
                "sharer_name": (
                    f"{share.sharer.first_name} {share.sharer.last_name}".strip()
                    or share.sharer.username
                ),
                "created_at": share.created_at,
            }
        except CourseShare.DoesNotExist:
            raise HttpError(404, "Link de partilha inválido ou expirado")

    async def claim_share(self, user, token: str) -> dict:
        try:
            share = await sync_to_async(CourseShare.objects.select_related("course").get)(token=token)
        except CourseShare.DoesNotExist:
            raise HttpError(404, "Link de partilha inválido")
        await self.enroll_course(user, share.course.id)
        await sync_to_async(CourseShareClaim.objects.get_or_create)(share=share, recipient=user)
        return {"success": True, "message": "Curso importado com sucesso!", "course_id": str(share.course.uuid)}

    async def get_course_claims(self, user, course_id: str) -> list:
        claims = await sync_to_async(
            lambda: list(
                CourseShareClaim.objects.filter(
                    share__course__uuid=course_id, share__sharer=user
                ).select_related("recipient").order_by("-claimed_at")
            )
        )()
        return [
            {
                "recipient_name": (
                    f"{c.recipient.first_name} {c.recipient.last_name}".strip()
                    or c.recipient.username
                ),
                "claimed_at": c.claimed_at,
            }
            for c in claims
        ]

    async def get_module_material(self, user, module_id: str) -> dict:
        try:
            module = await sync_to_async(
                Module.objects.select_related("material", "course").get
            )(uuid=module_id)
        except Module.DoesNotExist:
            raise HttpError(404, "Módulo não encontrado")

        enrolled = await sync_to_async(
            CourseEnrollment.objects.filter(
                course=module.course, user=user, deleted=False
            ).exists
        )()
        if not enrolled:
            raise HttpError(403, "Sem acesso a este módulo")

        try:
            mat = module.material
            pdf_url = None
            if mat.status == "READY" and mat.pdf_file:
                try:
                    pdf_url = mat.pdf_file.url
                except Exception:
                    pdf_url = None
            return {"status": mat.status, "pdf_url": pdf_url}
        except Exception:
            return {"status": "PROCESSING", "pdf_url": None}

    async def list_featured_courses(self, q: str = ""):
        result = cache.get("featured_courses")
        if result and not q:
            return result

        queryset = Course.objects.filter(status="READY").only(
            "uuid", "level", "thumb", "title", "desc"
        )
        if q:
            queryset = queryset.filter(title__icontains=q.strip())
        queryset = queryset[:12]
        courses = await sync_to_async(lambda: list(queryset))()

        result = []
        for c in courses:
            thumb_url = None
            if c.thumb:
                try:
                    thumb_url = c.thumb.url
                except Exception:
                    thumb_url = None
            result.append({
                "id": str(c.uuid),
                "title": c.title,
                "level": c.level,
                "thumb": thumb_url,
                "desc": c.desc,
            })
        if not q:
            cache.set("featured_courses", result, 3600)
        return result

    async def get_course_preview(self, course_id: str) -> dict:
        try:
            course = await sync_to_async(
                Course.objects.prefetch_related(
                    Prefetch(
                        "modules",
                        queryset=Module.objects.order_by("created_at").prefetch_related(
                            Prefetch("lessons", queryset=Lesson.objects.order_by("id"))
                        ),
                    ),
                ).select_related("owner").get
            )(uuid=course_id, status="READY")
        except Course.DoesNotExist:
            raise HttpError(404, "Curso não encontrado")

        thumb_url = None
        if course.thumb:
            try:
                thumb_url = course.thumb.url
            except Exception:
                thumb_url = str(course.thumb)

        owner = course.owner
        owner_name = None
        if owner:
            owner_name = f"{owner.first_name} {owner.last_name}".strip() or owner.username

        modules_data = []
        for module in course.modules.all():
            lessons = [{"title": l.title, "desc": l.desc} for l in module.lessons.all()]
            modules_data.append({
                "id": str(module.uuid),
                "name": module.name,
                "desc": module.desc,
                "lesson_count": len(lessons),
                "lessons": lessons,
            })

        return {
            "id": str(course.uuid),
            "title": course.title,
            "desc": course.desc,
            "level": course.level,
            "thumb": thumb_url,
            "owner_name": owner_name,
            "module_count": len(modules_data),
            "modules": modules_data,
        }

    async def clone_course(self, user, course_id: str) -> dict:
        try:
            course = await sync_to_async(Course.objects.get)(uuid=course_id, status="READY")
        except Course.DoesNotExist:
            raise HttpError(404, "Curso não encontrado")

        enrollment, created = await sync_to_async(CourseEnrollment.objects.get_or_create)(
            user=user, course=course, defaults={"deleted": False}
        )
        if not created and enrollment.deleted:
            enrollment.deleted = False
            await sync_to_async(enrollment.save)(update_fields=["deleted"])

        cache.delete(get_course_list_cache_key(user.id))
        return {"success": True, "course_id": str(course.uuid)}


class LessonService:
    async def get_lesson(self, user, lesson_id: str):
        cache_key = get_lesson_detail_cache_key(lesson_id)
        lesson = cache.get(cache_key)

        if not lesson:
            try:
                lesson = await sync_to_async(
                    Lesson.objects.select_related("module__course").get
                )(short_id=lesson_id)
                cache.set(cache_key, lesson, 3600)
            except Lesson.DoesNotExist:
                return None

        course = lesson.module.course
        enrolled = await sync_to_async(
            CourseEnrollment.objects.filter(course=course, user=user, deleted=False).exists
        )()
        if enrolled:
            return lesson
        return None

    async def mark_watched(self, user, lesson_id: str):
        try:
            lesson = await sync_to_async(
                Lesson.objects.select_related("module__course").get
            )(short_id=lesson_id)
        except Lesson.DoesNotExist:
            raise HttpError(404, "Lição não encontrada")

        from .models import LessonProgress

        await sync_to_async(LessonProgress.objects.update_or_create)(
            user=user, lesson=lesson, defaults={"watched": True}
        )
        invalidate_course_cache(lesson.module.course.uuid, user.id)
        return {"success": True}

    async def mark_delivered(self, user, lesson_id: str):
        try:
            lesson = await sync_to_async(
                Lesson.objects.select_related("module__course").get
            )(short_id=lesson_id)
        except Lesson.DoesNotExist:
            raise HttpError(404, "Lição não encontrada")

        course = lesson.module.course
        enrolled = await sync_to_async(
            CourseEnrollment.objects.filter(course=course, user=user).exists
        )()
        if not enrolled:
            raise HttpError(403, "Sem permissão")

        if not lesson.delivered:
            lesson.delivered = True
            await sync_to_async(lesson.save)(update_fields=["delivered"])

            course_id = lesson.module.course_id
            next_undelivered_lesson = await sync_to_async(
                Lesson.objects.filter(
                    module__course_id=course_id, delivered=False,
                )
                .only("module", "id", "status", "delivered")
                .order_by("module__created_at", "module__id", "id").first
            )()
            if next_undelivered_lesson and next_undelivered_lesson.status == "PENDING":
                generate_lesson_plan.delay(user.id, next_undelivered_lesson.id)

            invalidate_course_cache(course.uuid, user.id)
            return {"success": True}
        return {"info": "Sem aulas restantes"}
