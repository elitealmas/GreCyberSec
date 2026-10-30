import "server-only";
import type { PrivateContactRequest } from "@/lib/contact-validation";
import { turnstileExpectedHostname } from "@/lib/turnstile";

const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const labels: Record<PrivateContactRequest["requestType"], string> = {
  access: "Access request",
  correction: "Correction request",
  deletion: "Deletion request",
  photography: "Photography consent request",
  other: "Private enquiry",
};

function privateContactConfig() {
  const recipient = process.env.PRIVACY_CONTACT_EMAIL?.trim();
  const sender = (process.env.CONTACT_EMAIL_FROM ?? process.env.EVENT_EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL)?.trim();
  const apiKey = process.env.RESEND_API_KEY;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const expectedHostname = turnstileExpectedHostname();
  if (!recipient || !emailPattern.test(recipient) || !sender || /[\r\n]/.test(sender)
    || !apiKey || !siteKey || !expectedHostname) return null;
  return { recipient, sender, apiKey, siteKey, expectedHostname };
}

export function privateContactConfigured() {
  return Boolean(privateContactConfig());
}

export function privateContactHostname() {
  return privateContactConfig()?.expectedHostname ?? null;
}

export async function sendPrivateContactRequest(request: PrivateContactRequest, idempotencyKey: string) {
  const config = privateContactConfig();
  if (!config) return false;
  const text = `${labels[request.requestType]}\n\nName: ${request.name}\nReply email: ${request.email}\n\nRequest:\n${request.message}\n\nSubmitted through the private GreCyberSec website form.`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `private-contact/${idempotencyKey}`,
    },
    body: JSON.stringify({
      from: config.sender,
      to: [config.recipient],
      reply_to: request.email,
      subject: `[GreCyberSec private] ${labels[request.requestType]}`,
      text,
    }),
  });
  return response.ok;
}
