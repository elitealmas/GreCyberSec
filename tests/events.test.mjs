import assert from "node:assert/strict";
import test from "node:test";

import { beyondFirewall } from "../lib/beyond-firewall.ts";
import {
  events,
  formatEventDate,
  isEventExpired,
  pastEvents,
  upcomingEvents,
} from "../lib/events.ts";

const metropolis = events.find(({ id }) => id === "metropolis-hackathon-builder-day-london");
const encode = events.find(({ id }) => id === "encode-london-hackathon-and-conference");
const beyond = events.find(({ id }) => id === "beyond-the-firewall");

test("restores the exact ENCODE catalogue record from Git history", () => {
  assert.deepEqual(encode, {
    id: "encode-london-hackathon-and-conference",
    title: "Encode London Hackathon and Conference",
    category: "Technology event · Hackathon · Community",
    description: "Connect with the wider tech community through Encode London, with three days of learning, collaboration and new ideas.",
    startDate: "2026-10-23",
    endDate: "2026-10-25",
    location: "London",
    registrationUrl: "https://luma.com/encode-london-2026?tk=gZBVvx",
    external: true,
  });
});

test("preserves the earlier Metropolis event as historical catalogue data", () => {
  assert.deepEqual(metropolis, {
    id: "metropolis-hackathon-builder-day-london",
    title: "Metropolis Hackathon Builder Day: London",
    category: "Builder event · Hackathon · Technology",
    description: "Meet other builders, turn ideas into projects and take part in a hands-on London hackathon builder day.",
    startDate: "2026-10-02",
    endDate: "2026-10-02",
    location: "London",
    registrationUrl: "https://luma.com/metropolis-lon-oct-2026?tk=YMB9AI",
    external: true,
  });
});

test("shows ENCODE and Beyond the Firewall as upcoming on 21 October", () => {
  assert.deepEqual(
    upcomingEvents(events, new Date("2026-10-21T12:00:00.000Z")).map(({ title }) => title),
    ["Encode London Hackathon and Conference", "Beyond the Firewall"],
  );
  assert.deepEqual(
    pastEvents(events, new Date("2026-10-21T12:00:00.000Z")).map(({ title }) => title),
    ["Metropolis Hackathon Builder Day: London"],
  );
});

test("keeps ENCODE upcoming through its final London calendar day", () => {
  assert.equal(isEventExpired(encode, new Date("2026-10-25T23:59:59.999Z")), false);
  assert.equal(isEventExpired(encode, new Date("2026-10-26T00:00:00.000Z")), true);
});

test("keeps Beyond listed until exactly 4 PM on 29 October 2026", () => {
  assert.equal(isEventExpired(beyond, new Date("2026-10-29T15:59:59.999Z")), false);
  assert.equal(isEventExpired(beyond, new Date("2026-10-29T16:00:00.000Z")), true);
  assert.deepEqual(upcomingEvents(events, new Date("2026-10-29T15:59:59.999Z")).map(({ id }) => id), ["beyond-the-firewall"]);
  assert.deepEqual(upcomingEvents(events, new Date("2026-10-29T16:00:00.000Z")), []);
});

test("moves finished events into the past archive instead of deleting them", () => {
  assert.deepEqual(
    pastEvents(events, new Date("2026-10-29T16:00:00.000Z")).map(({ title }) => title),
    ["Beyond the Firewall", "Encode London Hackathon and Conference", "Metropolis Hackathon Builder Day: London"],
  );
});

test("keeps the Beyond catalogue entry synchronized with its registration configuration", () => {
  assert.equal(beyond.startDate, beyondFirewall.date);
  assert.equal(beyond.endDate, beyondFirewall.date);
  assert.equal(beyond.location, beyondFirewall.location);
  assert.equal(beyond.registrationUrl, "/events/beyond-the-firewall");
  assert.equal(beyond.external, false);
});

test("formats single-day and multi-day event dates", () => {
  assert.equal(formatEventDate(metropolis), "02 OCT 2026");
  assert.equal(formatEventDate(encode), "23–25 OCT 2026");
  assert.equal(formatEventDate(beyond), "29 OCT 2026");
});
