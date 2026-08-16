import { redirect } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) redirect("/login?message=configuration");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/login");
  const email = typeof data.claims.email === "string" ? data.claims.email : "your confirmed email";

  return <section className="site-shell min-h-[calc(100vh-22rem)] py-16 sm:py-24"><p className="eyebrow">Member dashboard</p><div className="mt-4 flex flex-wrap items-end justify-between gap-6"><div><h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Welcome to GreCyberSec.</h1><p className="mt-4 text-lg text-slate-300">Signed in as <span className="text-[#20ff62]">{email}</span></p></div><form action={logout}><button className="button button-secondary" type="submit">Sign out <span aria-hidden="true">→</span></button></form></div><section className="notice-panel mt-12 max-w-3xl"><p className="eyebrow">Coming next</p><h2 className="mt-3 text-2xl font-semibold text-white">Learning space in development</h2><p className="mt-4 leading-7 text-slate-300">Courses and progress tracking are not available yet. This placeholder is reserved for a future member learning area.</p></section></section>;
}
