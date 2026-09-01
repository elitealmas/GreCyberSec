const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function hasValidQuizSubmissionInput(courseSlug: string, quizId: string, moduleSlug: string) {
  return slugPattern.test(courseSlug) && uuidPattern.test(quizId) && (!moduleSlug || slugPattern.test(moduleSlug));
}

export function quizMatchesCourseContext({ courseId, quiz, moduleSlug, moduleId }: { courseId: string; quiz: { course_id: string; module_id: string | null } | null; moduleSlug: string; moduleId: string | null }) {
  if (moduleSlug && !moduleId) return false;
  return Boolean(quiz && quiz.course_id === courseId && quiz.module_id === moduleId);
}
