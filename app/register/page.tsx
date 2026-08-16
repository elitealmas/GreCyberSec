import Link from "next/link";
import { register } from "@/app/auth/actions";
import { AuthMessage } from "@/components/auth-message";
import { AuthShell } from "@/components/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Register" };
export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  if (!isSupabaseConfigured()) return <AuthShell eyebrow="Member registration" title="Create your account"><AuthMessage code="configuration" /></AuthShell>;
  return <AuthShell eyebrow="Member registration" title="Create your account"><p className="mt-4 text-slate-300">Choose a password with at least 12 characters, including uppercase, lowercase and a number.</p><AuthMessage code={message} /><form action={register} className="mt-8 grid gap-5"><div><label className="form-label" htmlFor="email">Email address</label><input className="form-input" id="email" name="email" type="email" autoComplete="email" maxLength={254} required /></div><div><label className="form-label" htmlFor="password">Password</label><input className="form-input" id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div><div><label className="form-label" htmlFor="confirmPassword">Confirm password</label><input className="form-input" id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div><button className="button button-primary w-fit" type="submit">Create account <span aria-hidden="true">→</span></button></form><p className="mt-6 text-sm text-slate-400">Already registered? <Link className="footer-link" href="/login">Sign in</Link></p></AuthShell>;
}
