import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthMessage } from "@/components/auth-message";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import { LoginRobot } from "@/components/login-robot";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  if (!isSupabaseConfigured()) return <AuthShell eyebrow="Member access" title="Sign in to GreCyberSec"><AuthMessage code="configuration" /></AuthShell>;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return <AuthShell eyebrow="Member access" title="Sign in to GreCyberSec"><AuthMessage code="turnstile-unavailable" /></AuthShell>;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/dashboard");
  return <AuthShell eyebrow="Member access" title="Sign in to GreCyberSec" aside={<LoginRobot />}><p className="mt-4 text-slate-300">Use your confirmed email address and password.</p><AuthMessage code={message} /><LoginForm siteKey={siteKey} /><p className="mt-6 text-sm text-slate-400"><Link className="footer-link" href="/forgot-password">Forgot your password?</Link> <span aria-hidden="true">·</span> <Link className="footer-link" href="/register">Create an account</Link></p></AuthShell>;
}
