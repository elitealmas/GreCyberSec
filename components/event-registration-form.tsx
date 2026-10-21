"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useActionState, useState, useSyncExternalStore } from "react";
import { registerForEvent, resendEventVerification, type EventActionState } from "@/app/events/beyond-the-firewall/actions";

const Turnstile = dynamic(() => import("@marsidev/react-turnstile").then(({ Turnstile: Widget }) => Widget), { ssr: false });
const initialState: EventActionState = { status: "idle", version: 0 };
const narrowScreen = "(max-width: 420px)";
const subscribeToScreenSize = (callback: () => void) => {
  const query = window.matchMedia(narrowScreen);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};

function SecurityCheck({ siteKey, pending, resend = false }: { siteKey: string; pending: boolean; resend?: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const compact = useSyncExternalStore(subscribeToScreenSize, () => window.matchMedia(narrowScreen).matches, () => true);

  return <>
    <input type="hidden" name="turnstileToken" value={token ?? ""} />
    <div className="turnstile-widget">
      <Turnstile
        key={`${attempt}-${compact}`}
        siteKey={siteKey}
        options={{ action: "event-register", theme: "dark", size: compact ? "compact" : "flexible", responseField: false }}
        onSuccess={(value) => { setToken(value); setFailed(false); }}
        onExpire={() => setToken(null)}
        onTimeout={() => setToken(null)}
        onError={() => { setToken(null); setFailed(true); }}
        onUnsupported={() => { setToken(null); setFailed(true); }}
      />
    </div>
    {failed && <div className="form-error" role="alert">
      <p>Security verification could not load.</p>
      <button className="text-link mt-2" type="button" onClick={() => { setToken(null); setFailed(false); setAttempt(attempt + 1); }}>Retry security check</button>
    </div>}
    <button className="button button-primary w-full" type="submit" disabled={!token || pending}>
      {pending ? "Sending…" : resend ? "Resend verification email" : "Send verification email"} <span aria-hidden="true">→</span>
    </button>
    <noscript><p className="form-error">Enable JavaScript to complete the security check and register.</p></noscript>
  </>;
}

function Status({ status, resend = false }: { status: EventActionState["status"]; resend?: boolean }) {
  const messages: Partial<Record<EventActionState["status"], string>> = {
    invalid: resend ? "Please enter a valid email address." : "Please check your name, email and photography choice.",
    turnstile: "Security verification failed or expired. Please complete it again.",
    "rate-limited": "Too many requests. Please wait 15 minutes and try again.",
    sent: "If this address is eligible, a verification email is on its way. Check your inbox and spam folder, then open the link to confirm your place. A new link replaces any earlier link.",
    closed: "Registration is currently closed.",
    error: "We couldn’t process your request. Please try again later.",
  };
  return messages[status] ? <p className={status === "sent" ? "form-success" : "form-error"} role="status" aria-live="polite">{messages[status]}</p> : null;
}

export function EventRegistrationForm({ siteKey, organiser, contact, retention }: { siteKey: string; organiser: string; contact: string; retention: number }) {
  const [state, action, pending] = useActionState(registerForEvent, initialState);
  const [resend, resendAction, resendPending] = useActionState(resendEventVerification, initialState);
  const [showResend, setShowResend] = useState(false);
  // Controlled values survive a failed server action so attendees need not re-enter them.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState<"yes" | "no" | "">("");

  if (showResend) return <div className="card min-w-0" id="registration">
    <p className="eyebrow">Check your inbox</p>
    <h2 className="mt-3 text-2xl font-semibold text-white">Resend verification</h2>
    <p className="mt-3 text-sm leading-6 text-slate-300">Use the email address from your registration. Requesting another email replaces your previous verification link.</p>
    <form action={resendAction} className="mt-5 grid gap-4" aria-busy={resendPending}>
      <div>
        <label className="form-label" htmlFor="resend-email">Email address</label>
        <input className="form-input" id="resend-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <Status status={resend.status} resend />
      <SecurityCheck key={resend.version} siteKey={siteKey} pending={resendPending} resend />
    </form>
    <button className="text-link mt-5" type="button" disabled={resendPending} onClick={() => setShowResend(false)}>Back to registration</button>
  </div>;

  return <div className="card min-w-0" id="registration">
    <p className="eyebrow">Reserve your place</p>
    <h2 className="mt-3 text-2xl font-semibold text-white">Register for the talk.</h2>
    <p className="mt-2 text-sm leading-6 text-slate-300">Confirm your email to complete your registration.</p>
    <form action={action} className="mt-5 grid gap-4" aria-busy={pending}>
      <div>
        <label className="form-label" htmlFor="event-name">Full name</label>
        <input className="form-input" id="event-name" name="fullName" autoComplete="name" minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} required />
      </div>
      <div>
        <label className="form-label" htmlFor="event-email">Email address</label>
        <input className="form-input" id="event-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>
      <fieldset aria-describedby="photography-description" className="grid gap-2">
        <legend className="form-label">Photography consent <span className="font-normal text-slate-400">(choose one)</span></legend>
        <p id="photography-description" className="text-sm leading-6 text-slate-300">May we use identifiable photographs of you for event reporting and promotion?</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="quiz-option items-center"><input type="radio" name="photographyConsent" value="yes" checked={consent === "yes"} onChange={() => setConsent("yes")} required /><span>Yes</span></label>
          <label className="quiz-option items-center"><input type="radio" name="photographyConsent" value="no" checked={consent === "no"} onChange={() => setConsent("no")} required /><span>No</span></label>
        </div>
        <p className="text-xs leading-5 text-slate-400">You are welcome to attend whichever option you choose.</p>
      </fieldset>
      <p className="text-xs leading-5 text-slate-400">{organiser} uses these details to manage your registration, send event emails and respect your photography choice. Photography may take place; choosing No does not affect registration or attendance. Event records are scheduled for deletion {retention} days after the talk. {contact.startsWith("/") ? <Link className="text-link" href={contact}>Contact us</Link> : <>Contact: {contact}</>}. <Link className="text-link" href="/privacy">Privacy notice</Link>.</p>
      <Status status={state.status} />
      {state.status !== "sent" && <SecurityCheck key={state.version} siteKey={siteKey} pending={pending} />}
    </form>
    <button className="text-link mt-5" type="button" disabled={pending} onClick={() => setShowResend(true)}>Need a new verification email?</button>
  </div>;
}
