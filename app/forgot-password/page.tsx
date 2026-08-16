import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";
import { AuthMessage } from "@/components/auth-message";
import { AuthShell } from "@/components/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  if (!isSupabaseConfigured()) return <AuthShell eyebrow="Password reset" title="Reset your password"><AuthMessage code="configuration" /></AuthShell>;
  return <AuthShell eyebrow="Password reset" title="Reset your password"><p className="mt-4 text-slate-300">Enter your email address and we’ll send instructions if an account exists for it.</p><AuthMessage code={message} /><form action={requestPasswordReset} className="mt-8 grid gap-5"><div><label className="form-label" htmlFor="email">Email address</label><input className="form-input" id="email" name="email" type="email" autoComplete="email" maxLength={254} required /></div><button className="button button-primary w-fit" type="submit">Send reset link <span aria-hidden="true">→</span></button></form><p className="mt-6 text-sm text-slate-400"><Link className="footer-link" href="/login">Back to sign in</Link></p></AuthShell>;
}
