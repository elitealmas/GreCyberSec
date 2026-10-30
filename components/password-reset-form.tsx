"use client";

import dynamic from "next/dynamic";
import { useState, type FormEvent } from "react";
import { requestPasswordReset } from "@/app/auth/actions";
import { FormSubmitButton } from "@/components/form-submit-button";

const Turnstile = dynamic(
  () => import("@marsidev/react-turnstile").then(({ Turnstile: Widget }) => Widget),
  { ssr: false },
);

export function PasswordResetForm({ siteKey }: { siteKey: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState(false);
  const [widgetError, setWidgetError] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!token) {
      event.preventDefault();
      setVerificationError(true);
    }
  }

  return <form action={requestPasswordReset} className="mt-8 grid gap-5" onSubmit={handleSubmit}>
    <div><label className="form-label" htmlFor="email">Email address</label><input className="form-input" id="email" name="email" type="email" autoComplete="email" maxLength={254} required /></div>
    <input name="turnstileToken" type="hidden" value={token ?? ""} />
    <div className="turnstile-widget"><Turnstile siteKey={siteKey} options={{ action: "password-reset", theme: "dark", size: "flexible", responseField: false }} onSuccess={(nextToken) => { setToken(nextToken); setVerificationError(false); setWidgetError(false); }} onExpire={() => setToken(null)} onTimeout={() => setToken(null)} onError={() => { setToken(null); setWidgetError(true); }} onUnsupported={() => { setToken(null); setWidgetError(true); }} /></div>
    {widgetError && <p className="form-error" role="alert">Security verification could not load. Refresh the page and try again.</p>}
    {verificationError && <p className="form-error" role="alert">Please complete the security verification and try again.</p>}
    <FormSubmitButton className="button button-primary w-fit" disabled={!token} pendingLabel="Sending reset link…">Send reset link <span aria-hidden="true">→</span></FormSubmitButton>
  </form>;
}
