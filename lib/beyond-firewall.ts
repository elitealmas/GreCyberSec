export const beyondFirewall = {
  id: "beyond-the-firewall",
  date: "2026-10-29",
  title: "Beyond the Firewall: Inside the Cybersecurity Industry",
  subtitle: "Inside the Cybersecurity Industry",
  timezone: "Europe/London",
  speakerName: "Ali Mohamed",
  speakerRole: "Platform Professional Services Consultant at CrowdStrike",
  speaker: "Ali Mohamed, Platform Professional Services Consultant at CrowdStrike",
  description: "Join us for an engaging guest talk with Ali Mohamed exploring real-world cybersecurity, career opportunities, security engineering, and insights from the industry. The event will also feature a live Q&A session.",
  location: "Board Room, Dreadnought Building, University of Greenwich, London, SE10 9LS.",
} as const;

// 14:00 and 16:00 are never in the UK's daylight-saving transition gap.
export function londonEventTimes(date: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const noon = new Date(Date.UTC(year, month - 1, day, 12));
  if (year < 2000 || year > 2100 || noon.getUTCFullYear() !== year || noon.getUTCMonth() !== month - 1 || noon.getUTCDate() !== day) return null;
  const offset = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "shortOffset" }).formatToParts(noon).find((part) => part.type === "timeZoneName")?.value;
  if (offset !== "GMT" && offset !== "GMT+1") return null;
  const hours = offset === "GMT+1" ? 1 : 0;
  return { start: new Date(Date.UTC(year, month - 1, day, 14 - hours)), end: new Date(Date.UTC(year, month - 1, day, 16 - hours)) };
}

export function eventDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: beyondFirewall.timezone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function eventIsOpen(end: Date, now = new Date()): boolean {
  return now.getTime() < end.getTime();
}

function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function calendarLinks(start: Date, end: Date, siteUrl: string) {
  const details = `${beyondFirewall.description}\n\nGuest speaker: ${beyondFirewall.speaker}`;
  const google = new URL("https://calendar.google.com/calendar/render");
  google.search = new URLSearchParams({ action: "TEMPLATE", text: beyondFirewall.title, dates: `${utcStamp(start)}/${utcStamp(end)}`, ctz: beyondFirewall.timezone, details, location: beyondFirewall.location }).toString();
  const outlook = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
  outlook.search = new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: beyondFirewall.title, startdt: start.toISOString(), enddt: end.toISOString(), body: details, location: beyondFirewall.location }).toString();
  return { google: google.toString(), outlook: outlook.toString(), ics: new URL("/events/beyond-the-firewall/calendar", siteUrl).toString() };
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

// Fold at 75 UTF-8 octets without splitting a Unicode code point (RFC 5545).
function foldLine(value: string): string {
  const encoder = new TextEncoder();
  let result = "";
  let length = 0;
  for (const char of value) {
    const bytes = encoder.encode(char).length;
    if (length + bytes > 75) { result += "\r\n "; length = 1; }
    result += char;
    length += bytes;
  }
  return result;
}

export function calendarIcs(start: Date, end: Date, siteUrl: string, now = new Date()): string {
  const hostname = new URL(siteUrl).hostname;
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GreCyberSec//Events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT", `UID:beyond-the-firewall-${utcStamp(start)}@${hostname}`, `DTSTAMP:${utcStamp(now)}`, `DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`, `SUMMARY:${icsEscape(beyondFirewall.title)}`, `LOCATION:${icsEscape(beyondFirewall.location)}`, `DESCRIPTION:${icsEscape(`${beyondFirewall.description}\n\nGuest speaker: ${beyondFirewall.speaker}`)}`, `URL:${new URL("/events/beyond-the-firewall", siteUrl).toString()}`, "STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR", ""].map(foldLine).join("\r\n");
}
