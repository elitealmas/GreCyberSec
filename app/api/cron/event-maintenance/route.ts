import { timingSafeEqual } from "node:crypto";
import { beyondFirewall } from "@/lib/beyond-firewall";
import { eventDatabase, eventPublicConfig, eventRegistrationConfig, sendPendingConfirmations } from "@/lib/event-registration-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = secret ? `Bearer ${secret}` : "";
  if (!secret || secret.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  const event = eventPublicConfig();
  try {
    const { data, error } = await eventDatabase().rpc("event_cleanup", { p_event: beyondFirewall.id, p_end: event.end.toISOString(), p_retention_days: 7 });
    if (error) throw new Error("Event cleanup failed");
    const config = eventRegistrationConfig();
    const delivery = config ? await sendPendingConfirmations(config) : null;
    const counts = Array.isArray(data) ? data[0] : null;
    if (counts?.stalled_emails) console.error("Event confirmation emails require operator attention", { count: counts.stalled_emails });
    const ok = !!config && delivery?.failures === 0 && !counts?.stalled_emails;
    return Response.json({ ok, cleanup: counts, delivery }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Event maintenance failed");
    return new Response("Event maintenance failed", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
