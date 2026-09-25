import assert from "node:assert/strict";
import test from "node:test";
import { formatEventDate, isEventExpired, upcomingEvents } from "../lib/events.ts";

const metropolis = { endDate: "2026-10-02" };
const encode = { endDate: "2026-10-25" };

test("keeps an event visible until its final London calendar day has passed", () => {
  assert.equal(isEventExpired(metropolis, new Date("2026-10-02T22:59:59.999Z")), false);
  assert.equal(isEventExpired(metropolis, new Date("2026-10-02T23:00:00.000Z")), true);
});

test("keeps the multi-day Encode event visible through 25 October in London", () => {
  assert.equal(isEventExpired(encode, new Date("2026-10-25T22:59:59.999Z")), false);
  assert.equal(isEventExpired(encode, new Date("2026-10-26T00:00:00.000Z")), true);
});

test("filters expired events and formats single- and multi-day dates", () => {
  const listedEvents = [
    { title: "Expired", startDate: "2026-10-02", endDate: "2026-10-02", description: "", registrationUrl: "https://example.com/expired", category: "" },
    { title: "Current", startDate: "2026-10-23", endDate: "2026-10-25", description: "", registrationUrl: "https://example.com/current", category: "" },
  ];

  assert.deepEqual(upcomingEvents(listedEvents, new Date("2026-10-24T12:00:00.000Z")).map(({ title }) => title), ["Current"]);
  assert.deepEqual(upcomingEvents(listedEvents, new Date("2026-10-26T12:00:00.000Z")), []);
  assert.equal(formatEventDate(listedEvents[0]), "02 OCT 2026");
  assert.equal(formatEventDate(listedEvents[1]), "23–25 OCT 2026");
});
