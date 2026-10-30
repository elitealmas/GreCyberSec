"use server";

import { randomUUID } from "node:crypto";
import { privateContactHostname, sendPrivateContactRequest } from "@/lib/contact-server";
import { validPrivateContactRequest } from "@/lib/contact-validation";
import { eventRateAllowed } from "@/lib/event-registration-server";
import { verifyTurnstileToken } from "@/lib/turnstile";

export type ContactActionState = { status: "idle" | "invalid" | "turnstile" | "rate-limited" | "sent" | "error"; version: number };
const result = (status: ContactActionState["status"]): ContactActionState => ({ status, version: Date.now() });

export async function sendPrivateContact(_state: ContactActionState, formData: FormData): Promise<ContactActionState> {
  const input = validPrivateContactRequest(formData);
  if (!input) return result("invalid");
  const hostname = privateContactHostname();
  const token = formData.get("turnstileToken");
  if (!hostname || typeof token !== "string" || !(await verifyTurnstileToken(token, "contact", hostname))) return result("turnstile");
  try {
    if (!(await eventRateAllowed("private-contact", input.normalized))) return result("rate-limited");
    return result(await sendPrivateContactRequest(input, randomUUID()) ? "sent" : "error");
  } catch {
    console.error("Private contact delivery unavailable");
    return result("error");
  }
}
