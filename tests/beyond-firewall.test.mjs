import assert from "node:assert/strict";
import test from "node:test";
import { beyondFirewall, calendarIcs, calendarLinks, eventDateLabel, eventIsOpen, londonEventTimes } from "../lib/beyond-firewall.ts";

test("uses the requested Thursday 29 October event in London after DST ends", () => {
  assert.equal(beyondFirewall.date, "2026-10-29");
  assert.equal(beyondFirewall.timezone, "Europe/London");
  const { start, end } = londonEventTimes(beyondFirewall.date);
  assert.equal(start.toISOString(), "2026-10-29T14:00:00.000Z");
  assert.equal(end.toISOString(), "2026-10-29T16:00:00.000Z");
  assert.equal(eventDateLabel(start), "Thursday, 29 October 2026");
  assert.equal(beyondFirewall.speakerName, "Ali Mohamed");
  assert.equal(beyondFirewall.speakerRole, "Platform Professional Services Consultant at CrowdStrike");
  assert.equal(beyondFirewall.location, "Board Room, Dreadnought Building, University of Greenwich, London, SE10 9LS.");
});

test("rejects missing, out-of-range and invalid event dates", () => {
  for (const date of ["", "1999-12-31", "2101-01-01", "2026-02-29", "2026-02-30", "2026-13-01", "2026-00-01", "2026-10-00", "2026-1-02", "2026-10-29T14:00:00Z"]) {
    assert.equal(londonEventTimes(date), null, date);
  }
  assert.equal(londonEventTimes("2028-02-29").start.toISOString(), "2028-02-29T14:00:00.000Z");
});

test("uses London summer and winter offsets including transition days", () => {
  assert.equal(londonEventTimes("2026-03-28").start.toISOString(), "2026-03-28T14:00:00.000Z");
  assert.equal(londonEventTimes("2026-03-29").start.toISOString(), "2026-03-29T13:00:00.000Z");
  assert.equal(londonEventTimes("2026-10-24").end.toISOString(), "2026-10-24T15:00:00.000Z");
  assert.equal(londonEventTimes("2026-10-25").end.toISOString(), "2026-10-25T16:00:00.000Z");
});

test("closes exactly at the event end", () => {
  const { end } = londonEventTimes(beyondFirewall.date);
  assert.equal(eventIsOpen(end, new Date("2026-10-29T15:59:59.999Z")), true);
  assert.equal(eventIsOpen(end, end), false);
  assert.equal(eventIsOpen(end, new Date("2026-10-29T16:00:00.001Z")), false);
});

test("Google and Outlook carry matching UTC times and public event details", () => {
  const { start, end } = londonEventTimes(beyondFirewall.date);
  const links = calendarLinks(start, end, "https://example.org");
  const google = new URL(links.google);
  const outlook = new URL(links.outlook);
  assert.equal(google.searchParams.get("dates"), "20261029T140000Z/20261029T160000Z");
  assert.equal(google.searchParams.get("ctz"), "Europe/London");
  assert.equal(google.searchParams.get("text"), beyondFirewall.title);
  assert.equal(google.searchParams.get("location"), beyondFirewall.location);
  assert.match(google.searchParams.get("details"), /Ali Mohamed/);
  assert.equal(outlook.searchParams.get("startdt"), start.toISOString());
  assert.equal(outlook.searchParams.get("enddt"), end.toISOString());
  assert.equal(outlook.searchParams.get("subject"), beyondFirewall.title);
  assert.equal(outlook.searchParams.get("location"), beyondFirewall.location);
  assert.equal(outlook.searchParams.get("body"), google.searchParams.get("details"));
  assert.equal(links.ics, "https://example.org/events/beyond-the-firewall/calendar");
});

test("ICS uses CRLF, correct UTC timestamps, escaped text, and legal UTF-8 folding", () => {
  const { start, end } = londonEventTimes(beyondFirewall.date);
  const ics = calendarIcs(start, end, "https://example.org", new Date("2026-10-01T00:00:00Z"));
  const unfolded = ics.replace(/\r\n /g, "");
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /\r\nEND:VCALENDAR\r\n$/);
  assert.match(ics, /DTSTAMP:20261001T000000Z\r\n/);
  assert.match(ics, /DTSTART:20261029T140000Z\r\n/);
  assert.match(ics, /DTEND:20261029T160000Z\r\n/);
  assert.match(unfolded, /UID:beyond-the-firewall-20261029T140000Z@example.org\r\n/);
  assert.match(unfolded, /LOCATION:Board Room\\, Dreadnought Building\\, University of Greenwich\\, London\\, SE10 9LS\./);
  assert.ok(unfolded.includes(`SUMMARY:${beyondFirewall.title}\r\n`));
  assert.ok(unfolded.includes("\\n\\nGuest speaker: Ali Mohamed\\, Platform Professional Services Consultant at CrowdStrike"));
  assert.ok(ics.split("\r\n").every((line) => Buffer.byteLength(line, "utf8") <= 75));
  assert.equal(ics.replace(/\r\n/g, "").includes("\n"), false);
  assert.doesNotMatch(ics, /ATTENDEE|token|email=/i);
});

test("calendar UID remains stable across downloads", () => {
  const { start, end } = londonEventTimes(beyondFirewall.date);
  const first = calendarIcs(start, end, "https://example.org", new Date("2026-10-01"));
  const second = calendarIcs(start, end, "https://example.org", new Date("2026-10-02"));
  assert.equal(first.match(/^UID:.*$/m)[0], second.match(/^UID:.*$/m)[0]);
});
