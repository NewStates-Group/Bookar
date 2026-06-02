export interface ExplicadorCourseContext {
  course_id: string;
  course_title: string;
  module_name?: string;
  lesson_id?: string;
  lesson_title?: string;
  lesson_description?: string;
  narration?: string;
}

const MAX_NARRATION_CHARS = 6000;

export function truncateNarration(text: string | null | undefined): string | undefined {
  if (!text?.trim()) return undefined;
  const trimmed = text.trim();
  if (trimmed.length <= MAX_NARRATION_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_NARRATION_CHARS)}…`;
}

export function buildExplicadorCourseContext(params: {
  courseId: string;
  courseTitle: string;
  moduleName?: string;
  lessonId?: string;
  lessonTitle?: string;
  lessonDescription?: string;
  narration?: string | null;
}): ExplicadorCourseContext {
  return {
    course_id: params.courseId,
    course_title: params.courseTitle,
    module_name: params.moduleName,
    lesson_id: params.lessonId,
    lesson_title: params.lessonTitle,
    lesson_description: params.lessonDescription,
    narration: truncateNarration(params.narration),
  };
}
