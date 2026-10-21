"use server";

import { createHash, randomBytes } from "node:crypto";
import { after } from "next/server";
import { beyondFirewall, eventIsOpen } from "@/lib/beyond-firewall";
import { validEventEmail, validEventRegistration } from "@/lib/event-registration-validation";
import { eventDatabase, eventRateAllowed, eventRegistrationConfig, sendPendingConfirmations, sendVerificationEmail } from "@/lib/event-registration-server";
import { verifyTurnstileToken } from "@/lib/turnstile";

export type EventActionState = { status: "idle" | "invalid" | "turnstile" | "rate-limited" | "sent" | "closed" | "error" | "verified" | "expired"; version: number };
const result = (status: EventActionState["status"]): EventActionState => ({ status, version: Date.now() });
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function registerForEvent(_state: EventActionState, formData: FormData): Promise<EventActionState> {
  const config = eventRegistrationConfig();
  if (!config || !eventIsOpen(config.end)) return result("closed");
  const input = validEventRegistration(formData);
  if (!input) return result("invalid");
  try {
    if (!(await eventRateAllowed("registration", input.normalized))) return result("rate-limited");
    const turnstile = formData.get("turnstileToken");
    if (typeof turnstile !== "string" || !(await verifyTurnstileToken(turnstile, "event-register", config.expectedHostname))) return result("turnstile");
    const token = randomBytes(32).toString("hex");
    const tokenHash = hash(token);
    const db = eventDatabase();
    const { data: id, error } = await db.rpc("event_register_pending", { p_event: beyondFirewall.id, p_name: input.name, p_email: input.email, p_normalized: input.normalized, p_consent: input.consent, p_hash: tokenHash, p_expires: new Date(Math.min(Date.now() + config.minutes * 60_000, config.end.getTime())).toISOString(), p_end: config.end.toISOString() });
    if (error) throw new Error("Event registration database failure");
    if (id) {
      try { if (!(await sendVerificationEmail(input.email, token, tokenHash, config))) console.error("Event verification email not accepted"); }
      catch { console.error("Event verification email delivery unavailable"); }
    }
    // The same response is returned for existing verified or cancelled addresses.
    return result("sent");
  } catch {
    console.error("Event registration unavailable");
    return result("error");
  }
}

export async function resendEventVerification(_state: EventActionState, formData: FormData): Promise<EventActionState> {
  const config = eventRegistrationConfig();
  if (!config || !eventIsOpen(config.end)) return result("closed");
  const input = validEventEmail(formData.get("email"));
  if (!input) return result("invalid");
  try {
    if (!(await eventRateAllowed("registration", input.normalized))) return result("rate-limited");
    const turnstile = formData.get("turnstileToken");
    if (typeof turnstile !== "string" || !(await verifyTurnstileToken(turnstile, "event-register", config.expectedHostname))) return result("turnstile");
    const token = randomBytes(32).toString("hex");
    const tokenHash = hash(token);
    const db = eventDatabase();
    const { data: recipient, error } = await db.rpc("event_resend_pending", { p_event: beyondFirewall.id, p_normalized: input.normalized, p_hash: tokenHash, p_expires: new Date(Math.min(Date.now() + config.minutes * 60_000, config.end.getTime())).toISOString(), p_end: config.end.toISOString() });
    if (error) throw new Error("Event resend database failure");
    if (recipient) {
      try { if (!(await sendVerificationEmail(recipient, token, tokenHash, config))) console.error("Event verification email not accepted"); }
      catch { console.error("Event verification email delivery unavailable"); }
    }
    return result("sent");
  } catch {
    console.error("Event verification resend unavailable");
    return result("error");
  }
}

export async function verifyEventRegistration(_state: EventActionState, formData: FormData): Promise<EventActionState> {
  const config = eventRegistrationConfig();
  if (!config || !eventIsOpen(config.end)) return result("closed");
  const token = formData.get("token");
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return result("expired");
  try {
    const tokenHash = hash(token);
    if (!(await eventRateAllowed("verification", tokenHash))) return result("rate-limited");
    const { data, error } = await eventDatabase().rpc("event_verify_registration", { p_event: beyondFirewall.id, p_hash: tokenHash, p_end: config.end.toISOString() });
    if (error) throw new Error("Event verification database failure");
    if (data !== true) return result("expired");
    after(async () => {
      try { await sendPendingConfirmations(config); } catch { console.error("Event confirmation queue unavailable"); }
    });
    return result("verified");
  } catch {
    console.error("Event verification unavailable");
    return result("error");
  }
}
