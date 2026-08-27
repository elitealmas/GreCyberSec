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
  slug: string;
  title: string;
  summary: string;
  position: number;
  lessons: Lesson[];
  completedLessons: number;
  completionPercentage: number;
  quiz: QuizSummary | null;
};

export type QuizSummary = {
  id: string;
  title: string;
  passing_score: number;
  module_id: string | null;
  attempts: Array<{ id: string; score: number; passed: boolean; submitted_at: string }>;
};

export type Course = {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: string | null;
  estimatedHours: number | null;
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
type RawModule = { id: string; slug: string; title: string; summary: string; position: number; lessons: RawLesson[] | null };
type RawCourse = { id: string; slug: string; title: string; description: string; difficulty: string | null; estimated_hours: number | null; course_modules: RawModule[] | null };

export async function requireMemberSession() {
  if (!isSupabaseConfigured()) redirect("/login?message=configuration");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (error || !userId) redirect("/login");
  return { supabase, userId };
}

function normaliseCourse(raw: RawCourse, completedLessonIds: Set<string>, quizzes: QuizSummary[] = []): Course {
  const modules = (raw.course_modules ?? [])
    .map((module) => ({
      ...module,
      lessons: (module.lessons ?? []).sort((a, b) => a.position - b.position).map((lesson) => ({
        ...lesson,
        content: lesson.content ?? "",
      })),
      completedLessons: 0,
      completionPercentage: 0,
      quiz: quizzes.find((quiz) => quiz.module_id === module.id) ?? null,
    }))
    .sort((a, b) => a.position - b.position)
    .map((module) => {
      const completedLessons = module.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
      return {
        ...module,
        completedLessons,
        completionPercentage: module.lessons.length === 0 ? 0 : Math.round((completedLessons / module.lessons.length) * 100),
      };
    });
  const totalLessons = modules.reduce((total, module) => total + module.lessons.length, 0);
  const completedLessons = modules.flatMap((module) => module.lessons).filter((lesson) => completedLessonIds.has(lesson.id)).length;

  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    description: raw.description,
    difficulty: raw.difficulty,
    estimatedHours: raw.estimated_hours,
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

const courseSelect = "id, slug, title, description, difficulty, estimated_hours, course_modules(id, slug, title, summary, position, lessons(id, slug, title, summary, content, position))";

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
  const [completed, quizzes] = await Promise.all([completedLessonIds(supabase, lessonIds), getQuizSummaries(supabase, rawCourse.id)]);
  return normaliseCourse(rawCourse, completed, quizzes);
}

export async function getQuizForCourse(supabase: Supabase, courseId: string) {
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, title, instructions, passing_score, quiz_questions(id, prompt, question_type, options, position)")
    .eq("course_id", courseId)
    .is("module_id", null)
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

export async function getQuizForModule(supabase: Supabase, courseId: string, moduleId: string) {
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, title, instructions, passing_score, quiz_questions(id, prompt, question_type, options, position)")
    .eq("course_id", courseId)
    .eq("module_id", moduleId)
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

export async function getQuizById(supabase: Supabase, quizId: string) {
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, course_id, module_id")
    .eq("id", quizId)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw new Error("Quiz content is unavailable.");
  return data as { id: string; course_id: string; module_id: string | null } | null;
}

async function getQuizSummaries(supabase: Supabase, courseId: string): Promise<QuizSummary[]> {
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, title, passing_score, module_id")
    .eq("course_id", courseId)
    .eq("is_published", true);
  if (error) throw new Error("Quiz content is unavailable.");
  const quizzes = (data ?? []) as Array<{ id: string; title: string; passing_score: number; module_id: string | null }>;
  if (quizzes.length === 0) return [];
  const { data: attempts, error: attemptsError } = await supabase
    .from("quiz_attempts")
    .select("id, quiz_id, score, passed, submitted_at")
    .in("quiz_id", quizzes.map((quiz) => quiz.id))
    .order("submitted_at", { ascending: false });
  if (attemptsError) throw new Error("Quiz attempts are unavailable.");
  return quizzes.map((quiz) => ({
    ...quiz,
    passing_score: Number(quiz.passing_score),
    attempts: (attempts ?? []).filter((attempt) => attempt.quiz_id === quiz.id) as QuizSummary["attempts"],
  }));
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
