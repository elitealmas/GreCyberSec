import Link from "next/link";
import { CourseProgress } from "@/components/course-progress";
import { getCoursesWithProgress, requireMemberSession } from "@/lib/courses";

export const metadata = { title: "Courses", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const { supabase, userId } = await requireMemberSession();

  let courses: Awaited<ReturnType<typeof getCoursesWithProgress>>;
  try {
    courses = await getCoursesWithProgress(supabase, userId);
  } catch {
    return <section className="site-shell min-h-[calc(100vh-22rem)] py-16 sm:py-24"><p className="eyebrow">Member learning space</p><article className="notice-panel mt-6 max-w-2xl"><h1 className="text-3xl font-semibold text-white">Courses are nearly ready.</h1><p className="mt-4 leading-7 text-slate-300">Course content is temporarily unavailable. Please try again later, or contact the society if the problem continues.</p></article></section>;
  }

  return <section className="site-shell min-h-[calc(100vh-22rem)] py-16 sm:py-24">
    <p className="eyebrow">Member learning space</p>
    <div className="mt-4 max-w-3xl"><h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Build skills, one safe step at a time.</h1><p className="mt-5 text-lg leading-8 text-slate-300">Short, practical learning paths for GreCyberSec members. Your progress is stored securely with your account.</p></div>
    <div className="mt-12 grid gap-6 lg:grid-cols-3">{courses.map((course) => <article className="course-card" key={course.id}><p className="eyebrow">Course</p><h2 className="mt-3 text-2xl font-semibold text-white">{course.title}</h2><p className="mt-4 flex-1 leading-7 text-slate-300">{course.description}</p><div className="mt-7"><CourseProgress completed={course.completedLessons} total={course.totalLessons} /></div><Link className="button button-primary mt-7 w-fit" href={`/courses/${course.slug}`}>{course.completedLessons > 0 ? "Continue course" : "Start course"} <span aria-hidden="true">→</span></Link></article>)}</div>
    {courses.length === 0 && <section className="notice-panel mt-12"><p className="eyebrow">No courses yet</p><p className="mt-3 text-slate-300">Course content is not available yet. Confirm that the learning-system migration has been applied in Supabase.</p></section>}
  </section>;
}
