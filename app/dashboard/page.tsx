import { redirect } from "next/navigation";
import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { CourseProgress } from "@/components/course-progress";
import { FormSubmitButton } from "@/components/form-submit-button";
import { getCoursesWithProgress } from "@/lib/courses";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) redirect("/login?message=configuration");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (error || !userId) redirect("/login");
  const email = typeof claims?.email === "string" ? claims.email : "your confirmed email";
  let courses: Awaited<ReturnType<typeof getCoursesWithProgress>> | null = null;
  try {
    courses = await getCoursesWithProgress(supabase, userId);
  } catch {
    // The member dashboard stays available if the learning migration has not been applied yet.
  }

  return <section className="site-shell min-h-[calc(100vh-22rem)] py-16 sm:py-24"><p className="eyebrow">Member dashboard</p><div className="mt-4 flex flex-wrap items-end justify-between gap-6"><div><h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Welcome to GreCyberSec.</h1><p className="mt-4 text-lg text-slate-300">Signed in as <span className="text-[#20ff62]">{email}</span></p></div><form action={logout}><FormSubmitButton className="button button-secondary" pendingLabel="Signing you out…">Sign out <span aria-hidden="true">→</span></FormSubmitButton></form></div>{courses ? <section className="mt-12"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Learning progress</p><h2 className="mt-3 text-2xl font-semibold text-white">Pick up where you left off.</h2></div><Link className="text-link" href="/courses">View all courses →</Link></div><div className="mt-7 grid gap-5 lg:grid-cols-3">{courses.map((course) => <article className="course-card min-h-0" key={course.id}><h3 className="text-lg font-semibold text-white">{course.title}</h3><div className="mt-6"><CourseProgress completed={course.completedLessons} total={course.totalLessons} /></div><Link className="button button-secondary mt-6 w-fit" href={`/courses/${course.slug}`}>{course.completedLessons > 0 ? "Resume" : "Start"} <span aria-hidden="true">→</span></Link></article>)}</div></section> : <section className="notice-panel mt-12 max-w-3xl"><p className="eyebrow">Learning space</p><h2 className="mt-3 text-2xl font-semibold text-white">Courses are nearly ready.</h2><p className="mt-4 leading-7 text-slate-300">Apply the learning-system Supabase migration to enable courses and persistent progress.</p></section>}</section>;
}
