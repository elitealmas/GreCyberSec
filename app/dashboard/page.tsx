import { redirect } from "next/navigation";
import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
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
  return <section className="site-shell min-h-[calc(100vh-22rem)] py-16 sm:py-24"><p className="eyebrow">Member dashboard</p><div className="mt-4 flex flex-wrap items-end justify-between gap-6"><div><h1 className="text-4xl font-semibold tracking-tight text-heading sm:text-5xl">Welcome to GreCyberSec.</h1><p className="mt-4 text-lg text-body">Signed in as <span className="text-accent">{email}</span></p></div><form action={logout}><FormSubmitButton className="button button-secondary" pendingLabel="Signing you out…">Sign out <span className="button-arrow" aria-hidden="true">→</span></FormSubmitButton></form></div><div className="mt-12 grid gap-5 md:grid-cols-2"><article className="card" data-title="EVENTS.LOG"><p className="eyebrow">What&apos;s on</p><h2 className="mt-3 text-2xl text-heading">Upcoming events</h2><p className="mt-3 leading-7 text-body">Talks, workshops and hackathons from GreCyberSec and our partners.</p><Link className="button button-secondary mt-6" href="/events">Browse events <span className="button-arrow" aria-hidden="true">→</span></Link></article><article className="card" data-title="PEOPLE.DIR"><p className="eyebrow">The team</p><h2 className="mt-3 text-2xl text-heading">Meet the people</h2><p className="mt-3 leading-7 text-body">The committee running the society and how to reach them.</p><Link className="button button-secondary mt-6" href="/people">Meet the people <span className="button-arrow" aria-hidden="true">→</span></Link></article></div></section>;
}
