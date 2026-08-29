"use client";

import { useActionState } from "react";
import { submitContact, initialContactState } from "@/app/contact/actions";
import { RobotLoader } from "@/components/robot-loader";

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContact, initialContactState);
  return <form action={action} className="card grid gap-5" noValidate>
    <div className="sr-only" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" autoComplete="off" tabIndex={-1} /></div>
    <div><label className="form-label" htmlFor="name">Name</label><input className="form-input" id="name" name="name" autoComplete="name" maxLength={80} required aria-describedby={state.errors?.name ? "name-error" : undefined} />{state.errors?.name && <p id="name-error" className="form-error">{state.errors.name}</p>}</div>
    <div><label className="form-label" htmlFor="email">University email address</label><input className="form-input" id="email" name="email" type="email" autoComplete="email" maxLength={254} required aria-describedby={state.errors?.email ? "email-error" : undefined} />{state.errors?.email && <p id="email-error" className="form-error">{state.errors.email}</p>}</div>
    <div><label className="form-label" htmlFor="message">How can we help?</label><textarea className="form-input min-h-36 resize-y" id="message" name="message" maxLength={1500} required aria-describedby={state.errors?.message ? "message-error" : undefined} />{state.errors?.message && <p id="message-error" className="form-error">{state.errors.message}</p>}</div>
    <p className="text-sm leading-6 text-slate-400">This initial form validates your message only. It does not send or store personal data.</p>
    <button className="button button-primary w-fit" type="submit" disabled={pending}>{pending ? <RobotLoader size="small" label="Validating…" /> : <>Validate message<span aria-hidden="true"> →</span></>}</button>
    <p aria-live="polite" className={state.success ? "form-success" : "sr-only"}>{state.message}</p>
  </form>;
}
