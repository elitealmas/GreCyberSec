import type { EmailOtpType } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { confirmAuth } from "@/app/auth/confirm/actions";
import { AuthShell } from "@/components/auth-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { confirmationFailurePath } from "@/lib/auth-callback";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Confirm email", robots: { index: false, follow: false, nocache: true } };
export const dynamic = "force-dynamic";

const supportedTypes = new Set<EmailOtpType>(["email", "recovery"]);

export default async function ConfirmAuthPage({ searchParams }: { searchParams: Promise<{ code?: string; token_hash?: string; type?: string; next?: string }> }) {
  if (!isSupabaseConfigured()) redirect("/login?message=configuration");
  const { code = "", token_hash: tokenHash = "", type: typeValue = "", next: nextValue = "" } = await searchParams;
  const type = supportedTypes.has(typeValue as EmailOtpType) ? typeValue as EmailOtpType : "";
  const hasCode = code.length > 0 && code.length <= 2048;
  const hasTokenHash = tokenHash.length > 0 && tokenHash.length <= 2048 && Boolean(type);
  if (!hasCode && !hasTokenHash) redirect(confirmationFailurePath);

  return <AuthShell eyebrow="Email security" title="Confirm this request">
    <p className="mt-4 leading-7 text-slate-300">For your protection, email links do not change your account on page load. Press the button to continue.</p>
    <form action={confirmAuth} className="mt-8">
      {hasCode && <input name="code" type="hidden" value={code} />}
      {hasTokenHash && <input name="tokenHash" type="hidden" value={tokenHash} />}
      {type && <input name="type" type="hidden" value={type} />}
      {nextValue === "recovery" && <input name="next" type="hidden" value="recovery" />}
      <FormSubmitButton className="button button-primary w-fit" pendingLabel="Confirming…">Confirm and continue <span aria-hidden="true">→</span></FormSubmitButton>
    </form>
  </AuthShell>;
}
