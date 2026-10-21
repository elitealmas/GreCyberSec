import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { PageHero } from "@/components/page-hero";
import {
  events,
  formatEventDate,
  pastEvents,
  upcomingEvents,
  type GreCyberSecEvent,
} from "@/lib/events";

export const metadata: Metadata = {
  title: "Events | GRE CyberSec",
  description:
    "Explore upcoming and past GRE CyberSec events, workshops, guest talks and community opportunities.",
};

function EventCard({
  event,
  archived = false,
}: {
  event: GreCyberSecEvent;
  archived?: boolean;
}) {
  const linkLabel = archived
    ? event.external
      ? "View archived event"
      : "View event page"
    : event.linkLabel ?? "View event";

  const linkClassName = archived ? "button button-secondary w-fit" : "button button-primary w-fit";
  const cardContent = (
    <>
      <span className="pill w-fit">
        {archived ? `Past event · ${event.category}` : event.category}
      </span>
      <p className="event-date mt-5">
        {formatEventDate(event)}
        {event.timeLabel ? ` · ${event.timeLabel}` : ""}
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">{event.title}</h2>
      <p className="mt-4 flex-1 leading-7 text-slate-300">{event.description}</p>
      {event.location ? <p className="mt-5 text-sm leading-6 text-slate-400">{event.location}</p> : null}
    </>
  );

  return (
    <article className="card event-card flex h-full flex-col">
      {cardContent}
      <div className="mt-7">
        {event.external ? (
          <a
            className={linkClassName}
            href={event.registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {linkLabel} <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <Link className={linkClassName} href={event.registrationUrl}>
            {linkLabel} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </article>
  );
}

export default async function EventsPage() {
  await connection();

  const now = new Date();
  const upcoming = upcomingEvents(events, now);
  const past = pastEvents(events, now);

  return (
    <>
      <PageHero
        eyebrow="Events"
        title="Learn, build and connect with the cybersecurity community."
      >
        <p>Join GreCyberSec for guest talks, workshops, hackathons and wider community events.</p>
      </PageHero>

      <section className="site-shell py-16 sm:py-24" aria-labelledby="upcoming-events-heading">
        <div className="max-w-3xl">
            <p className="eyebrow">Upcoming events</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white" id="upcoming-events-heading">Join us beyond the classroom.</h2>
            <p className="mt-4 leading-7 text-slate-300">Choose an event below for details and registration.</p>
        </div>

        {upcoming.length > 0 ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="notice-panel mt-10 max-w-3xl">
            <p className="text-xl font-semibold tracking-tight text-white">No upcoming events right now.</p>
            <p className="mt-3 leading-7 text-slate-300">More GreCyberSec events will be announced here.</p>
          </div>
        )}
      </section>

      {past.length > 0 ? (
        <section className="section-alt" aria-labelledby="past-events-heading">
          <div className="site-shell py-16 sm:py-24">
            <div className="max-w-3xl">
              <p className="eyebrow">Past events</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white" id="past-events-heading">Explore our event archive.</h2>
              <p className="mt-4 leading-7 text-slate-300">Finished events remain here as part of the GreCyberSec programme history.</p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {past.map((event) => (
                <EventCard key={event.id} event={event} archived />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
