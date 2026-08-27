import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseProgress } from "@/components/course-progress";
import { getCourseWithProgress, getQuizAttempts, getQuizForCourse, requireMemberSession } from "@/lib/courses";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;
  const { supabase } = await requireMemberSession();
  const course = await getCourseWithProgress(supabase, courseSlug);
  if (!course) notFound();
  const quiz = await getQuizForCourse(supabase, course.id);
  const attempts = quiz ? await getQuizAttempts(supabase, quiz.id) : [];

  return <section className="site-shell min-h-[calc(100vh-22rem)] py-16 sm:py-24">
    <Link className="text-link" href="/courses">← All courses</Link>
    <p className="eyebrow mt-8">Course pathway</p><h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">{course.title}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">{course.description}</p>
    <div className="course-summary mt-9 max-w-3xl"><CourseProgress completed={course.completedLessons} total={course.totalLessons} /></div>
    <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]"><div className="space-y-6">{course.modules.map((module) => <section className="course-module" key={module.id}><p className="eyebrow">Module {module.position}</p><h2 className="mt-3 text-2xl font-semibold text-white">{module.title}</h2><ol className="mt-5 divide-y divide-white/10 border-y border-white/10">{module.lessons.map((lesson) => { const completed = course.completedLessonIds.has(lesson.id); return <li className="flex items-center justify-between gap-5 py-4" key={lesson.id}><div><p className="font-semibold text-white">{lesson.title}</p><p className="mt-1 text-sm text-slate-400">{lesson.summary}</p></div><Link className={completed ? "lesson-status lesson-status-complete" : "lesson-status"} href={`/courses/${course.slug}/lessons/${lesson.slug}`}>{completed ? "Complete" : "Open"} <span aria-hidden="true">→</span></Link></li>; })}</ol></section>)}</div>
      <aside className="course-sidebar"><p className="eyebrow">Final assessment</p><h2 className="mt-3 text-xl font-semibold text-white">{quiz?.title ?? "Quiz coming soon"}</h2><p className="mt-3 text-sm leading-6 text-slate-300">{quiz ? `Pass mark: ${quiz.passing_score}%. Multiple choice is scored immediately; written and code responses are saved for review.` : "A final assessment will be added once the course is ready."}</p>{quiz && <Link className="button button-primary mt-6 w-full" href={`/courses/${course.slug}/quiz`}>Take final quiz <span aria-hidden="true">→</span></Link>}{attempts.length > 0 && <div className="mt-6 border-t border-white/10 pt-5"><p className="text-sm text-slate-400">Previous attempts</p><ul className="mt-3 space-y-2 text-sm">{attempts.slice(0, 3).map((attempt) => <li key={attempt.id}><Link className="footer-link" href={`/courses/${course.slug}/quiz/results/${attempt.id}`}>{attempt.passed ? "Passed" : "Needs another try"} · {Number(attempt.score)}%</Link></li>)}</ul></div>}</aside></div>
  </section>;
}
