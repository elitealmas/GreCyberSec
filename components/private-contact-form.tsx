"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { sendPrivateContact, type ContactActionState } from "@/app/contact/actions";

const Turnstile = dynamic(() => import("@marsidev/react-turnstile").then(({ Turnstile: Widget }) => Widget), { ssr: false });
const initialState: ContactActionState = { status: "idle", version: 0 };

const messages: Partial<Record<ContactActionState["status"], string>> = {
  invalid: "Check each field and keep the message between 10 and 3,000 characters.",
  turnstile: "Security verification failed or expired. Please complete it again.",
  "rate-limited": "Too many requests were made. Please wait 15 minutes and try again.",
  error: "Your request could not be sent. Please try again later.",
};

export function PrivateContactForm({ siteKey }: { siteKey: string }) {
  const [state, action, pending] = useActionState(sendPrivateContact, initialState);

  if (state.status === "sent") return <div className="notice-panel mt-8">
    <p className="eyebrow">Request sent privately</p>
    <h3 className="mt-3 text-2xl font-semibold text-white">The committee mailbox has it.</h3>
    <p className="mt-4 leading-7 text-slate-300">We may reply to verify your identity before acting on a data request.</p>
  </div>;

  return <PrivateContactFields key={state.version} siteKey={siteKey} state={state} action={action} pending={pending} />;
}

function PrivateContactFields({ siteKey, state, action, pending }: {
  siteKey: string;
  state: ContactActionState;
  action: (payload: FormData) => void;
  pending: boolean;
}) {
  const [token, setToken] = useState<string | null>(null);

  return <form action={action} className="mt-8 grid gap-5" aria-busy={pending}>
    <div><label className="form-label" htmlFor="private-name">Full name</label><input className="form-input" id="private-name" name="name" autoComplete="name" minLength={2} maxLength={120} required /></div>
    <div><label className="form-label" htmlFor="private-email">Reply email</label><input className="form-input" id="private-email" name="email" type="email" autoComplete="email" maxLength={254} required /></div>
    <div><label className="form-label" htmlFor="private-type">What do you need?</label><select className="form-input" id="private-type" name="requestType" defaultValue="other" required><option value="access">Access my information</option><option value="correction">Correct my information</option><option value="deletion">Delete my information</option><option value="photography">Change photography consent</option><option value="other">Private enquiry</option></select></div>
    <div><label className="form-label" htmlFor="private-message">Message</label><textarea className="form-input min-h-36" id="private-message" name="message" minLength={10} maxLength={3000} required /></div>
    <input name="turnstileToken" type="hidden" value={token ?? ""} />
    {messages[state.status] && <p className="form-error" role="status" aria-live="polite">{messages[state.status]}</p>}
    <div className="turnstile-widget"><Turnstile siteKey={siteKey} options={{ action: "contact", theme: "dark", size: "flexible", responseField: false }} onSuccess={(value) => setToken(value)} onExpire={() => setToken(null)} onTimeout={() => setToken(null)} onError={() => setToken(null)} onUnsupported={() => setToken(null)} /></div>
    <button className="button button-primary w-fit" type="submit" disabled={!token || pending}>{pending ? "Sending privately…" : "Send private request →"}</button>
    <noscript><p className="form-error">Enable JavaScript to complete the security check and send this form.</p></noscript>
  </form>;
}
