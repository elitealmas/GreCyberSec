import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type Lesson = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  position: number;
};

export type CourseModule = {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
};

export type Course = {
  id: string;
  slug: string;
  title: string;
  description: string;
  modules: CourseModule[];
  totalLessons: number;
  completedLessons: number;
  completionPercentage: number;
  completedLessonIds: Set<string>;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  question_type: "mcq" | "written" | "code";
  options: string[];
  position: number;
};

export type Quiz = {
  id: string;
  title: string;
  instructions: string;
  passing_score: number;
  questions: QuizQuestion[];
};

type Supabase = Awaited<ReturnType<typeof createClient>>;
type RawLesson = Omit<Lesson, "content"> & { content?: string };
type RawModule = { id: string; title: string; position: number; lessons: RawLesson[] | null };
type RawCourse = { id: string; slug: string; title: string; description: string; course_modules: RawModule[] | null };

export async function requireMemberSession() {
  if (!isSupabaseConfigured()) redirect("/login?message=configuration");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (error || !userId) redirect("/login");
  return { supabase, userId };
}

function normaliseCourse(raw: RawCourse, completedLessonIds: Set<string>): Course {
  const modules = (raw.course_modules ?? [])
    .map((module) => ({
      ...module,
      lessons: (module.lessons ?? []).sort((a, b) => a.position - b.position).map((lesson) => ({
        ...lesson,
        content: lesson.content ?? "",
      })),
    }))
    .sort((a, b) => a.position - b.position);
  const totalLessons = modules.reduce((total, module) => total + module.lessons.length, 0);
  const completedLessons = modules.flatMap((module) => module.lessons).filter((lesson) => completedLessonIds.has(lesson.id)).length;

  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    description: raw.description,
    modules,
    totalLessons,
    completedLessons,
    completionPercentage: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
    completedLessonIds,
  };
}

async function completedLessonIds(supabase: Supabase, lessonIds: string[]) {
  if (lessonIds.length === 0) return new Set<string>();
  const { data, error } = await supabase.from("lesson_progress").select("lesson_id").in("lesson_id", lessonIds);
  if (error) throw new Error("Learning progress is unavailable.");
  return new Set((data ?? []).map((progress) => progress.lesson_id));
}

const courseSelect = "id, slug, title, description, course_modules(id, title, position, lessons(id, slug, title, summary, content, position))";

export async function getCoursesWithProgress(supabase: Supabase) {
  const { data, error } = await supabase.from("courses").select(courseSelect).eq("is_published", true).order("title");
  if (error) throw new Error("Course content is unavailable.");
  const rawCourses = (data ?? []) as unknown as RawCourse[];
  const lessonIds = rawCourses.flatMap((course) => (course.course_modules ?? []).flatMap((module) => (module.lessons ?? []).map((lesson) => lesson.id)));
  const completed = await completedLessonIds(supabase, lessonIds);
  return rawCourses.map((course) => normaliseCourse(course, completed));
}

export async function getCourseWithProgress(supabase: Supabase, slug: string) {
  const { data, error } = await supabase.from("courses").select(courseSelect).eq("slug", slug).eq("is_published", true).maybeSingle();
  if (error) throw new Error("Course content is unavailable.");
  if (!data) return null;
  const rawCourse = data as unknown as RawCourse;
  const lessonIds = (rawCourse.course_modules ?? []).flatMap((module) => (module.lessons ?? []).map((lesson) => lesson.id));
  return normaliseCourse(rawCourse, await completedLessonIds(supabase, lessonIds));
}

export async function getQuizForCourse(supabase: Supabase, courseId: string) {
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, title, instructions, passing_score, quiz_questions(id, prompt, question_type, options, position)")
    .eq("course_id", courseId)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw new Error("Quiz content is unavailable.");
  if (!data) return null;
  const quiz = data as unknown as { id: string; title: string; instructions: string; passing_score: number; quiz_questions: QuizQuestion[] | null };
  return {
    id: quiz.id,
    title: quiz.title,
    instructions: quiz.instructions,
    passing_score: Number(quiz.passing_score),
    questions: (quiz.quiz_questions ?? []).sort((a, b) => a.position - b.position),
  } satisfies Quiz;
}

export async function getQuizAttempts(supabase: Supabase, quizId: string) {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("id, score, passed, submitted_at")
    .eq("quiz_id", quizId)
    .order("submitted_at", { ascending: false });
  if (error) throw new Error("Quiz attempts are unavailable.");
  return (data ?? []) as Array<{ id: string; score: number; passed: boolean; submitted_at: string }>;
}

export async function getQuizAttempt(supabase: Supabase, attemptId: string) {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("id, quiz_id, score, correct_answers, scoreable_questions, passed, submitted_at, quiz_answers(response, is_correct, feedback, quiz_questions(prompt, question_type, position))")
    .eq("id", attemptId)
    .maybeSingle();
  if (error) throw new Error("Quiz attempt is unavailable.");
  return data as unknown as {
    id: string;
    quiz_id: string;
    score: number;
    correct_answers: number;
    scoreable_questions: number;
    passed: boolean;
    submitted_at: string;
    quiz_answers: Array<{ response: string; is_correct: boolean | null; feedback: string | null; quiz_questions: { prompt: string; question_type: "mcq" | "written" | "code"; position: number } | null }> | null;
  } | null;
}
