import "server-only";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { beyondFirewall, calendarLinks, eventDateLabel, londonEventTimes } from "@/lib/beyond-firewall";

export function eventPublicConfig() {
  // The page, email, calendar and database migration share this confirmed date.
  const date = beyondFirewall.date;
  const times = londonEventTimes(date);
  return times ? { date, ...times } : null;
}

function origin(value: string | undefined): URL | null {
  try {
    const url = new URL(value ?? "");
    const protocols = process.env.NODE_ENV === "production" ? ["https:"] : ["https:", "http:"];
    return protocols.includes(url.protocol) && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash ? url : null;
  } catch { return null; }
}

function databaseCredentials() {
  const url = origin(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)?.origin;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const worker = process.env.SUPABASE_EVENT_WORKER_JWT;
  if (worker) return url && publicKey && validWorkerToken(worker) ? { url, key: publicKey, worker } : null;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key, worker: undefined } : null;
}

function emailFrom() {
  return process.env.EVENT_EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL;
}

export function eventRegistrationConfig() {
  const event = eventPublicConfig();
  const site = origin(process.env.NEXT_PUBLIC_SITE_URL);
  const credentials = databaseCredentials();
  const retention = 7;
  const minutes = Number(process.env.EVENT_VERIFICATION_MINUTES || "30");
  const organiser = process.env.EVENT_ORGANISER_NAME?.trim() || "GreCyberSec";
  const contact = process.env.EVENT_PRIVACY_CONTACT?.trim() || "/contact";
  const expectedHostname = process.env.TURNSTILE_EXPECTED_HOSTNAME?.trim() || site?.hostname;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Cloudflare's published test credentials must never open production registration.
  const testKeys = /^(?:1x|2x|3x)0{10,}/;
  if (!event || !site || !credentials || !siteKey || !secret || !expectedHostname || expectedHostname !== site.hostname
    || (process.env.NODE_ENV === "production" && (testKeys.test(siteKey) || testKeys.test(secret)))
    || !process.env.RESEND_API_KEY || !emailFrom() || /[\r\n]/.test(emailFrom()!)
    || organiser.length > 160 || contact.length > 254
    || !Number.isInteger(minutes) || minutes < 5 || minutes > 120
    || (process.env.EVENT_SECURITY_KEY !== undefined && process.env.EVENT_SECURITY_KEY.length < 32)) return null;
  return { ...event, siteUrl: site.origin, retention, minutes, organiser, contact, expectedHostname };
}

function validWorkerToken(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: string; exp?: number };
    // Supabase, not this configuration check, verifies the signature.
    return claims.role === "gcs_event_worker" && typeof claims.exp === "number" && claims.exp * 1000 > Date.now();
  } catch { return false; }
}

export function eventDatabase() {
  const credentials = databaseCredentials();
  if (!credentials) throw new Error("Event database is not configured");
  return createClient(credentials.url, credentials.key, {
    ...(credentials.worker ? { accessToken: async () => credentials.worker! } : {}),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
  });
}

export function eventBucket(scope: string, value: string) {
  const credentials = databaseCredentials();
  const key = process.env.EVENT_SECURITY_KEY ?? credentials?.worker ?? credentials?.key;
  if (!key) throw new Error("Event rate limiting is not configured");
  return createHmac("sha256", key).update(`event:${beyondFirewall.id}:${scope}:${value}`).digest("hex");
}

export async function eventRateAllowed(scope: string, normalized: string): Promise<boolean> {
  const db = eventDatabase();
  for (const [bucket, limit] of [[eventBucket(scope, normalized), 3], [eventBucket(scope, "global"), 150]] as const) {
    const { data, error } = await db.rpc("event_rate_limit", { p_bucket: bucket, p_max: limit, p_seconds: 900 });
    if (error) throw new Error("Event rate limiter unavailable");
    if (data !== true) return false;
  }
  return true;
}

async function sendEmail(to: string, subject: string, text: string, idempotencyKey: string): Promise<boolean> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ from: emailFrom(), to: [to], subject, text }),
  });
  return response.ok;
}

export async function sendVerificationEmail(email: string, token: string, tokenHash: string, config: NonNullable<ReturnType<typeof eventRegistrationConfig>>) {
  const link = `${config.siteUrl}/events/beyond-the-firewall/verify#${token}`;
  return sendEmail(email, "Verify your registration — Beyond the Firewall", `Please verify your email to complete your registration for ${beyondFirewall.title}.\n\nOpen this link and press Confirm registration:\n${link}\n\nThis link expires after ${config.minutes} minutes or when the event ends, whichever comes first. If you did not request this, you can ignore this email.\n\n${config.organiser}`, `event-verify/${tokenHash}`);
}

export async function sendPendingConfirmations(config: NonNullable<ReturnType<typeof eventRegistrationConfig>>) {
  const db = eventDatabase();
  const { data, error } = await db.rpc("event_claim_emails", { p_event: beyondFirewall.id });
  if (error) throw new Error("Event email queue unavailable");
  const jobs = (data ?? []) as { job_id: string; full_name: string; email: string; lease_token: string }[];
  let failures = 0;
  // Bounded parallel batches finish within the route duration; each job has a DB lease.
  for (let offset = 0; offset < jobs.length; offset += 5) {
    await Promise.all(jobs.slice(offset, offset + 5).map(async (job) => {
      let accepted = false;
      try {
        const firstName = job.full_name.trim().split(/\s+/)[0];
        const links = calendarLinks(config.start, config.end, config.siteUrl);
        const text = `Hi ${firstName},\n\nYour registration for ${beyondFirewall.title} has been successfully confirmed!\n\nDate: ${eventDateLabel(config.start)}\nTime: 2:00 PM – 4:00 PM (Europe/London)\nVenue: ${beyondFirewall.location}\n\nGuest Speaker: ${beyondFirewall.speaker}.\n\nWe look forward to seeing you!\n\nAdd to Google Calendar: ${links.google}\n\nAdd to Outlook Calendar: ${links.outlook}\n\nDownload Calendar Event (.ics): ${links.ics}\n\n${config.organiser}`;
        accepted = await sendEmail(job.email, "Registration Confirmed — Beyond the Firewall", text, `event-confirmation/${job.job_id}`);
      } catch { accepted = false; }
      if (!accepted) failures++;
      try {
        const { error: finishError } = await db.rpc("event_finish_email", { p_job: job.job_id, p_accepted: accepted, p_lease_token: job.lease_token });
        if (finishError) failures++;
      } catch { failures++; }
    }));
  }
  if (failures) console.error("Event confirmation delivery needs retry", { failures });
  return { attempted: jobs.length, failures };
}
