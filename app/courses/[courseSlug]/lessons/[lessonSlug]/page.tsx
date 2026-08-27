import Link from "next/link";
import { notFound } from "next/navigation";
import { setLessonCompletion } from "@/app/courses/actions";
import { CourseMessage } from "@/components/course-message";
import { LessonMarkdown } from "@/components/lesson-markdown";
import { CourseProgress } from "@/components/course-progress";
import { getCourseWithProgress, requireMemberSession } from "@/lib/courses";

export const dynamic = "force-dynamic";

export default async function LessonPage({ params, searchParams }: { params: Promise<{ courseSlug: string; lessonSlug: string }>; searchParams: Promise<{ message?: string }> }) {
  const { courseSlug, lessonSlug } = await params;
  const { message } = await searchParams;
  const { supabase } = await requireMemberSession();
  const course = await getCourseWithProgress(supabase, courseSlug);
  if (!course) notFound();
  const lessons = course.modules.flatMap((module) => module.lessons);
  const lessonIndex = lessons.findIndex((lesson) => lesson.slug === lessonSlug);
  if (lessonIndex < 0) notFound();
  const lesson = lessons[lessonIndex];
  const completed = course.completedLessonIds.has(lesson.id);
  const previousLesson = lessons[lessonIndex - 1];
  const nextLesson = lessons[lessonIndex + 1];

  return <section className="site-shell min-h-[calc(100vh-22rem)] py-12 sm:py-20"><Link className="text-link" href={`/courses/${course.slug}`}>← {course.title}</Link><div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]"><article className="lesson-content"><p className="eyebrow">Lesson {lessonIndex + 1} of {course.totalLessons}</p><h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">{lesson.title}</h1><p className="mt-5 text-lg leading-8 text-slate-300">{lesson.summary}</p><div className="lesson-copy mt-10"><LessonMarkdown content={lesson.content} /></div><CourseMessage code={message} /><form action={setLessonCompletion} className="mt-10"><input name="courseSlug" type="hidden" value={course.slug} /><input name="lessonSlug" type="hidden" value={lesson.slug} /><input name="lessonId" type="hidden" value={lesson.id} /><input name="completion" type="hidden" value={completed ? "incomplete" : "complete"} /><button className={completed ? "button button-secondary" : "button button-primary"} type="submit">{completed ? "Mark as incomplete" : "Mark as complete"} <span aria-hidden="true">{completed ? "↺" : "✓"}</span></button></form><nav className="mt-12 flex flex-wrap justify-between gap-4 border-t border-white/10 pt-6" aria-label="Lesson navigation">{previousLesson ? <Link className="text-link" href={`/courses/${course.slug}/lessons/${previousLesson.slug}`}>← Previous lesson</Link> : <span />}{nextLesson ? <Link className="text-link" href={`/courses/${course.slug}/lessons/${nextLesson.slug}`}>Next lesson →</Link> : <Link className="text-link" href={`/courses/${course.slug}/quiz`}>Final assessment →</Link>}</nav></article><aside className="course-sidebar h-fit"><p className="eyebrow">Your progress</p><div className="mt-4"><CourseProgress completed={course.completedLessons} total={course.totalLessons} /></div></aside></div></section>;
}
