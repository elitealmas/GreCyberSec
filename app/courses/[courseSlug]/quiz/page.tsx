import Link from "next/link";
import { notFound } from "next/navigation";
import { submitQuizAttempt } from "@/app/courses/actions";
import { CourseMessage } from "@/components/course-message";
import { FormSubmitButton } from "@/components/form-submit-button";
import { getCourseWithProgress, getQuizForCourse, getQuizForModule, requireMemberSession } from "@/lib/courses";

export const dynamic = "force-dynamic";

export default async function QuizPage({ params, searchParams }: { params: Promise<{ courseSlug: string }>; searchParams: Promise<{ message?: string; module?: string }> }) {
  const { courseSlug } = await params;
  const { message, module: moduleSlug } = await searchParams;
  const { supabase } = await requireMemberSession();
  const course = await getCourseWithProgress(supabase, courseSlug);
  if (!course) notFound();
  const courseModule = moduleSlug ? course.modules.find((item) => item.slug === moduleSlug) : null;
  if (moduleSlug && !courseModule) notFound();
  const quiz = courseModule ? await getQuizForModule(supabase, course.id, courseModule.id) : await getQuizForCourse(supabase, course.id);
  if (!quiz) notFound();

  return <section className="site-shell min-h-[calc(100vh-22rem)] py-12 sm:py-20"><Link className="text-link" href={`/courses/${course.slug}`}>← {course.title}</Link><div className="mt-8 max-w-3xl"><p className="eyebrow">{courseModule ? `Module ${courseModule.position} knowledge check` : "Final assessment"}</p><h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">{quiz.title}</h1><p className="mt-5 text-lg leading-8 text-slate-300">{quiz.instructions}</p><p className="mt-4 text-sm text-[#b9ffc8]">Pass mark: {quiz.passing_score}%. Correct MCQ answers are checked after submission; written responses are saved for review only.</p><CourseMessage code={message} /></div><form action={submitQuizAttempt} className="mt-12 max-w-3xl space-y-7"><input name="courseSlug" type="hidden" value={course.slug} /><input name="quizId" type="hidden" value={quiz.id} />{courseModule && <input name="moduleSlug" type="hidden" value={courseModule.slug} />}{quiz.questions.map((question, index) => <fieldset className="quiz-question" key={question.id}><legend><span className="eyebrow">Question {index + 1}</span><span className="mt-3 block text-lg font-semibold text-white">{question.prompt}</span></legend>{question.question_type === "mcq" ? <div className="mt-5 grid gap-3">{question.options.map((option) => <label className="quiz-option" key={option}><input name={`answer-${question.id}`} type="radio" value={option} required /> <span>{option}</span></label>)}</div> : <textarea className="form-input mt-5 min-h-36" name={`answer-${question.id}`} maxLength={5000} required placeholder="Write your answer here." />}{question.question_type !== "mcq" && <p className="mt-3 text-sm text-slate-400">This response is saved for instructor review and is not automatically scored.</p>}</fieldset>)}<FormSubmitButton className="button button-primary" pendingLabel="Checking your answers…">Submit quiz <span aria-hidden="true">→</span></FormSubmitButton></form></section>;
}
