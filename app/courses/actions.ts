"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCourseWithProgress, getQuizById, getQuizForCourse, getQuizForModule, requireMemberSession } from "@/lib/courses";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function value(formData: FormData, field: string) {
  const input = formData.get(field);
  return typeof input === "string" ? input : "";
}

function coursePath(courseSlug: string) {
  return `/courses/${courseSlug}`;
}

export async function setLessonCompletion(formData: FormData) {
  const courseSlug = value(formData, "courseSlug");
  const lessonId = value(formData, "lessonId");
  const lessonSlug = value(formData, "lessonSlug");
  const shouldComplete = value(formData, "completion") === "complete";
  if (!slugPattern.test(courseSlug) || !slugPattern.test(lessonSlug) || !uuidPattern.test(lessonId)) redirect("/courses");

  const { supabase, userId } = await requireMemberSession();
  const course = await getCourseWithProgress(supabase, courseSlug);
  const lessonExists = course?.modules.some((module) => module.lessons.some((lesson) => lesson.id === lessonId && lesson.slug === lessonSlug));
  if (!course || !lessonExists) redirect("/courses");

  const mutation = shouldComplete
    ? supabase.from("lesson_progress").upsert({ user_id: userId, lesson_id: lessonId, completed_at: new Date().toISOString() }, { onConflict: "user_id,lesson_id" })
    : supabase.from("lesson_progress").delete().eq("user_id", userId).eq("lesson_id", lessonId);
  const { error } = await mutation;
  if (error) {
    console.error("Lesson progress update failed", { code: error.code });
    redirect(`${coursePath(courseSlug)}/lessons/${lessonSlug}?message=progress-unavailable`);
  }

  revalidatePath("/courses");
  revalidatePath(coursePath(courseSlug));
  revalidatePath(`${coursePath(courseSlug)}/lessons/${lessonSlug}`);
  revalidatePath("/dashboard");
  redirect(`${coursePath(courseSlug)}/lessons/${lessonSlug}`);
}

export async function submitQuizAttempt(formData: FormData) {
  const courseSlug = value(formData, "courseSlug");
  const quizId = value(formData, "quizId");
  const moduleSlug = value(formData, "moduleSlug");
  if (!slugPattern.test(courseSlug) || !uuidPattern.test(quizId) || (moduleSlug && !slugPattern.test(moduleSlug))) redirect("/courses");

  const { supabase } = await requireMemberSession();
  const course = await getCourseWithProgress(supabase, courseSlug);
  if (!course) redirect("/courses");
  const quizReference = await getQuizById(supabase, quizId);
  const courseModule = moduleSlug ? course.modules.find((item) => item.slug === moduleSlug) : null;
  if (!quizReference || quizReference.course_id !== course.id || quizReference.module_id !== (courseModule?.id ?? null)) redirect(coursePath(courseSlug));

  const quiz = courseModule ? await getQuizForModule(supabase, course.id, courseModule.id) : await getQuizForCourse(supabase, course.id);
  if (!quiz || quiz.id !== quizId) redirect(coursePath(courseSlug));

  const answers = quiz.questions.map((question) => ({
    question_id: question.id,
    response: value(formData, `answer-${question.id}`).slice(0, 5000),
  }));
  const { data, error } = await supabase.rpc("submit_quiz_attempt", { p_quiz_id: quiz.id, p_answers: answers });
  if (error) {
    console.error("Quiz attempt submission failed", { code: error.code });
    redirect(`${coursePath(courseSlug)}/quiz?${moduleSlug ? `module=${moduleSlug}&` : ""}message=quiz-unavailable`);
  }

  const attemptId = typeof (data as { attempt_id?: unknown } | null)?.attempt_id === "string" ? (data as { attempt_id: string }).attempt_id : "";
  if (!uuidPattern.test(attemptId)) redirect(`${coursePath(courseSlug)}/quiz?${moduleSlug ? `module=${moduleSlug}&` : ""}message=quiz-unavailable`);

  revalidatePath(coursePath(courseSlug));
  revalidatePath("/dashboard");
  redirect(`${coursePath(courseSlug)}/quiz/results/${attemptId}${moduleSlug ? `?module=${moduleSlug}` : ""}`);
}
