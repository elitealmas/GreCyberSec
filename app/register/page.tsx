import Link from "next/link";
import { AuthMessage } from "@/components/auth-message";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/register-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Register" };
export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  if (!isSupabaseConfigured()) return <AuthShell eyebrow="Member registration" title="Create your account"><AuthMessage code="configuration" /></AuthShell>;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return <AuthShell eyebrow="Member registration" title="Create your account"><AuthMessage code="turnstile-unavailable" /></AuthShell>;
  return <AuthShell eyebrow="Member registration" title="Create your account"><p className="mt-4 text-slate-300">Choose a password with at least 12 characters, including uppercase, lowercase and a number.</p><AuthMessage code={message} /><RegisterForm siteKey={siteKey} /><p className="mt-6 text-sm text-slate-400">Already registered? <Link className="footer-link" href="/login">Sign in</Link></p></AuthShell>;
}
