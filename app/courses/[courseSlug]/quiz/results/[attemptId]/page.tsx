import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseWithProgress, getQuizAttempt, getQuizForCourse, requireMemberSession } from "@/lib/courses";

export const dynamic = "force-dynamic";

export default async function QuizResultsPage({ params }: { params: Promise<{ courseSlug: string; attemptId: string }> }) {
  const { courseSlug, attemptId } = await params;
  const { supabase } = await requireMemberSession();
  const course = await getCourseWithProgress(supabase, courseSlug);
  if (!course) notFound();
  const quiz = await getQuizForCourse(supabase, course.id);
  const attempt = await getQuizAttempt(supabase, attemptId);
  if (!quiz || !attempt || attempt.quiz_id !== quiz.id) notFound();
  const answers = (attempt.quiz_answers ?? []).sort((a, b) => (a.quiz_questions?.position ?? 0) - (b.quiz_questions?.position ?? 0));

  return <section className="site-shell min-h-[calc(100vh-22rem)] py-12 sm:py-20"><Link className="text-link" href={`/courses/${course.slug}`}>← {course.title}</Link><div className="quiz-result mt-8 max-w-3xl"><p className="eyebrow">Quiz result</p><h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">{attempt.passed ? "You passed." : "Keep learning and try again."}</h1><p className="mt-5 text-lg leading-8 text-slate-300">Your automatically scored MCQ result is <strong className="text-[#20ff62]">{Number(attempt.score)}%</strong> ({attempt.correct_answers} / {attempt.scoreable_questions}). The pass mark is {quiz.passing_score}%.</p><p className="mt-3 text-sm text-slate-400">Submitted {new Date(attempt.submitted_at).toLocaleString("en-GB")}. Written and code responses are saved for review; they are not executed or automatically scored.</p></div><section className="mt-10 max-w-3xl space-y-5">{answers.map((answer, index) => <article className="quiz-answer" key={`${attempt.id}-${index}`}><p className="eyebrow">Question {index + 1}</p><h2 className="mt-2 font-semibold text-white">{answer.quiz_questions?.prompt}</h2><p className="mt-4 whitespace-pre-wrap text-slate-300">{answer.response || "No response provided."}</p><p className={answer.is_correct === true ? "quiz-feedback quiz-feedback-correct" : answer.is_correct === false ? "quiz-feedback" : "quiz-feedback quiz-feedback-review"}>{answer.feedback ?? "Saved for review"}</p></article>)}</section><div className="mt-10 flex flex-wrap gap-4"><Link className="button button-primary" href={`/courses/${course.slug}/quiz`}>Try again <span aria-hidden="true">↺</span></Link><Link className="button button-secondary" href={`/courses/${course.slug}`}>Back to course</Link></div></section>;
}
