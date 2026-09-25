import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { events, formatEventDate, upcomingEvents } from "@/lib/events";
export const metadata: Metadata = { title: "Events", description: "Upcoming GreCyberSec events at the University of Greenwich." };

export default function EventsPage() {
  const upcoming = upcomingEvents(events);

  return <><PageHero eyebrow="Events" title="Build with the wider tech community."><p>Discover upcoming opportunities to meet other builders, learn new skills and take part in technology events with GreCyberSec and our partners.</p></PageHero><section className="site-shell py-16 sm:py-24"><div className="max-w-3xl"><p className="eyebrow">Upcoming opportunities</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Join us beyond the classroom.</h2><p className="mt-4 leading-7 text-slate-300">Registration is managed by our event partners. Each link opens in a new tab.</p></div>{upcoming.length > 0 ? <div className="mt-10 grid gap-5 md:grid-cols-2">{upcoming.map((event) => <article className="card event-card flex h-full flex-col" key={event.registrationUrl}><p className="pill">{event.category}</p><p className="event-date mt-5">{formatEventDate(event)}</p><h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">{event.title}</h3><p className="mt-4 flex-1 leading-7 text-slate-300">{event.description}</p><div className="mt-7"><a className="button button-primary w-fit" href={event.registrationUrl} target="_blank" rel="noopener noreferrer">Register now <span aria-hidden="true">↗</span></a></div></article>)}</div> : <div className="notice-panel mt-10 max-w-3xl"><p className="text-xl font-semibold tracking-tight text-white">No upcoming events right now.</p><p className="mt-3 leading-7 text-slate-300">More GreCyberSec events are coming soon.</p></div>}</section></>;
}
