import { calendarIcs } from "@/lib/beyond-firewall";
import { eventPublicConfig } from "@/lib/event-registration-server";
import { getSiteUrl } from "@/lib/supabase/config";

export async function GET() {
  const event = eventPublicConfig();
  try {
    const siteUrl = getSiteUrl("/");
    return new Response(calendarIcs(event.start, event.end, siteUrl), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": "attachment; filename=\"beyond-the-firewall.ics\"", "Cache-Control": "no-store" } });
  } catch { return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
