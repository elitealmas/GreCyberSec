import { redirect } from "next/navigation";
import { updatePassword } from "@/app/auth/actions";
import { AuthMessage } from "@/components/auth-message";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Update password" };
export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  if (!isSupabaseConfigured()) redirect("/login?message=configuration");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/forgot-password?message=confirmation-error");
  const { message } = await searchParams;
  return <AuthShell eyebrow="Password reset" title="Choose a new password"><p className="mt-4 text-slate-300">Use at least 12 characters, including uppercase, lowercase and a number.</p><AuthMessage code={message} /><form action={updatePassword} className="mt-8 grid gap-5"><div><label className="form-label" htmlFor="password">New password</label><input className="form-input" id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div><div><label className="form-label" htmlFor="confirmPassword">Confirm new password</label><input className="form-input" id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div><button className="button button-primary w-fit" type="submit">Update password <span aria-hidden="true">→</span></button></form></AuthShell>;
}
