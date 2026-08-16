import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/app/auth/actions";
import { AuthMessage } from "@/components/auth-message";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  if (!isSupabaseConfigured()) return <AuthShell eyebrow="Member access" title="Sign in to GreCyberSec"><AuthMessage code="configuration" /></AuthShell>;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/dashboard");
  return <AuthShell eyebrow="Member access" title="Sign in to GreCyberSec"><p className="mt-4 text-slate-300">Use your confirmed email address and password.</p><AuthMessage code={message} /><form action={login} className="mt-8 grid gap-5"><div><label className="form-label" htmlFor="email">Email address</label><input className="form-input" id="email" name="email" type="email" autoComplete="email" maxLength={254} required /></div><div><label className="form-label" htmlFor="password">Password</label><input className="form-input" id="password" name="password" type="password" autoComplete="current-password" maxLength={128} required /></div><button className="button button-primary w-fit" type="submit">Sign in <span aria-hidden="true">→</span></button></form><p className="mt-6 text-sm text-slate-400"><Link className="footer-link" href="/forgot-password">Forgot your password?</Link> <span aria-hidden="true">·</span> <Link className="footer-link" href="/register">Create an account</Link></p></AuthShell>;
}
