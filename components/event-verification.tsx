"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { verifyEventRegistration, type EventActionState } from "@/app/events/beyond-the-firewall/actions";

const initialState: EventActionState = { status: "idle", version: 0 };

type CalendarLinks = { google: string; outlook: string; ics: string };

export function EventVerification({ links, open }: { links: CalendarLinks | null; open: boolean }) {
  const [state, action, pending] = useActionState(verifyEventRegistration, initialState);
  const token = useRef("");
  const tokenInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fragments never reach the server; remove them from the address/history as
    // soon as the page hydrates, including when the event is closed.
    const fragment = window.location.hash.slice(1);
    window.history.replaceState(window.history.state, "", window.location.pathname);
    if (fragment) token.current = /^[a-f0-9]{64}$/.test(fragment) ? fragment : "";
    if (state.status === "verified") token.current = "";
    if (tokenInput.current) tokenInput.current.value = token.current;
  }, [state.status]);

  if (state.status === "verified" && links) return <div className="notice-panel">
    <p className="eyebrow">Registration confirmed</p>
    <h2 className="mt-3 text-2xl font-semibold text-white">You’re on the list.</h2>
    <p className="mt-4 leading-7 text-slate-300">Your email is verified and your place is confirmed. We’re sending your event details by email. You can also save the talk to your calendar below.</p>
    <div className="mt-6 flex flex-wrap gap-3">
      <a className="button button-secondary" href={links.google} target="_blank" rel="noopener noreferrer">Google Calendar ↗</a>
      <a className="button button-secondary" href={links.outlook} target="_blank" rel="noopener noreferrer">Outlook ↗</a>
      <a className="button button-secondary" href={links.ics}>Apple / download .ics</a>
    </div>
    <Link className="text-link mt-5 inline-block" href="/events/beyond-the-firewall">View event details</Link>
  </div>;

  if (!open || !links) return <div className="notice-panel">
    <h2 className="text-2xl font-semibold text-white">{!open ? "Registration is closed." : "Verification is temporarily unavailable."}</h2>
    <p className="mt-4 text-slate-300"><Link className="text-link" href="/events/beyond-the-firewall">Return to the event page</Link> for the latest information.</p>
  </div>;

  const message = state.status === "expired"
    ? "This link has expired, was already used, or is incomplete. If you have not already confirmed your place, request a new verification email."
    : state.status === "closed" ? "Registration has closed for this event."
    : state.status === "rate-limited" ? "Too many attempts. Please wait 15 minutes and try again."
    : state.status === "error" ? "Verification is temporarily unavailable. Please try again."
    : null;

  return <div className="notice-panel">
    <p className="eyebrow">One last step</p>
    <h2 className="mt-3 text-2xl font-semibold text-white">Confirm your registration.</h2>
    <p className="mt-4 leading-7 text-slate-300">Select the button below to verify your email and confirm your place at Beyond the Firewall.</p>
    {message && <p className="form-error mt-4" role="status" aria-live="polite">{message}</p>}
    <form action={action} className="mt-6" aria-busy={pending} onSubmit={() => { if (tokenInput.current) tokenInput.current.value = token.current; }}>
      <input ref={tokenInput} type="hidden" name="token" />
      <button className="button button-primary w-fit" type="submit" disabled={pending || state.status === "expired" || state.status === "closed"}>{pending ? "Confirming…" : "Confirm registration"}</button>
    </form>
    <noscript><p className="form-error mt-4">Enable JavaScript, then reopen your email link to confirm your registration.</p></noscript>
    <p className="mt-5 text-sm text-slate-300"><Link className="text-link" href="/events/beyond-the-firewall#registration">Request another verification link</Link></p>
  </div>;
}
