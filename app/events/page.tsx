import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PageHero } from "@/components/page-hero";
import { eventDateLabel, eventIsOpen } from "@/lib/beyond-firewall";
import { eventPublicConfig } from "@/lib/event-registration-server";

export const metadata: Metadata = { title: "Events", description: "Upcoming GreCyberSec events at the University of Greenwich." };

export default async function EventsPage() {
  await connection();
  const event = eventPublicConfig();
  const open = event && eventIsOpen(event.end);

  return <>
    <PageHero eyebrow="Events" title="Learn from cybersecurity professionals.">
      <p>Join GreCyberSec for practical industry insight, career guidance and conversations with people working in security.</p>
    </PageHero>
    <section className="site-shell py-16 sm:py-24">
      <div className="max-w-3xl">
        <p className="eyebrow">Upcoming event</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Join us beyond the classroom.</h2>
      </div>
      {open ? <article className="card event-card mt-10 flex max-w-2xl flex-col">
        <p className="pill">Guest talk · Cybersecurity · Careers</p>
        <p className="event-date mt-5">{eventDateLabel(event.start)}</p>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">Beyond the Firewall</h3>
        <p className="mt-4 leading-7 text-slate-300">Inside the Cybersecurity Industry: a guest talk and live Q&amp;A with Ali Mohamed.</p>
        <div className="mt-7"><Link className="button button-primary w-fit" href="/events/beyond-the-firewall">Event details <span aria-hidden="true">→</span></Link></div>
      </article> : <div className="notice-panel mt-10 max-w-3xl">
        <p className="text-xl font-semibold tracking-tight text-white">No upcoming events right now.</p>
        <p className="mt-3 leading-7 text-slate-300">More GreCyberSec events will be announced here.</p>
      </div>}
    </section>
  </>;
}
