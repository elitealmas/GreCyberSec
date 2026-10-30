import Link from "next/link";
import { AuthMessage } from "@/components/auth-message";
import { AuthShell } from "@/components/auth-shell";
import { PasswordResetForm } from "@/components/password-reset-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  if (!isSupabaseConfigured()) return <AuthShell eyebrow="Password reset" title="Reset your password"><AuthMessage code="configuration" /></AuthShell>;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return <AuthShell eyebrow="Password reset" title="Reset your password"><AuthMessage code="turnstile-unavailable" /></AuthShell>;
  return <AuthShell eyebrow="Password reset" title="Reset your password"><p className="mt-4 text-slate-300">Enter your email address and we’ll send instructions if an account exists for it.</p><AuthMessage code={message} /><PasswordResetForm siteKey={siteKey} /><p className="mt-6 text-sm text-slate-400"><Link className="footer-link" href="/login">Back to sign in</Link></p></AuthShell>;
}
