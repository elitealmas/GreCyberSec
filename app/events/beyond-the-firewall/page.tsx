import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { EventRegistrationForm } from "@/components/event-registration-form";
import { PageHero } from "@/components/page-hero";
import { beyondFirewall, eventDateLabel, eventIsOpen } from "@/lib/beyond-firewall";
import { eventPublicConfig, eventRegistrationConfig } from "@/lib/event-registration-server";

export const metadata: Metadata = {
  title: "Beyond the Firewall",
  description: "Meet CrowdStrike consultant Ali Mohamed for cybersecurity career insights and live Q&A. Thursday 29 October 2026, 2–4 PM, University of Greenwich.",
};
export const maxDuration = 60;

export default async function BeyondFirewallPage() {
  // Availability must follow the current time, including after an unchanged deployment.
  await connection();
  const event = eventPublicConfig();
  const config = eventRegistrationConfig();
  const open = eventIsOpen(event.end);

  return <>
    <PageHero eyebrow="Guest speaker session" title="Beyond the Firewall"><p>{beyondFirewall.subtitle}</p></PageHero>
    <section className="site-shell grid gap-8 py-12 lg:grid-cols-[1fr_.9fr] lg:items-start sm:py-16">
      <div className="min-w-0">
        <p className="eyebrow">Industry insights · Career pathways · Live Q&amp;A</p>
        <h2 className="mt-4 text-3xl font-semibold text-white">A closer look at the world behind the firewall.</h2>
        <p className="mt-5 leading-8 text-slate-300">{beyondFirewall.description}</p>
        <div className="card mt-7">
          <p className="eyebrow">Event details</p>
          <dl className="mt-4 grid gap-4 text-slate-300">
            <div><dt className="font-semibold text-white">Date</dt><dd><time dateTime={beyondFirewall.date}>{eventDateLabel(event.start)}</time></dd></div>
            <div><dt className="font-semibold text-white">Time</dt><dd><time dateTime={event.start.toISOString()}>2:00 PM</time> – <time dateTime={event.end.toISOString()}>4:00 PM</time> (Europe/London)</dd></div>
            <div><dt className="font-semibold text-white">Venue</dt><dd>{beyondFirewall.location}</dd></div>
          </dl>
        </div>
        <div className="card mt-5">
          <p className="eyebrow">Guest speaker</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">{beyondFirewall.speakerName}</h2>
          <p className="mt-2 leading-7 text-slate-300">{beyondFirewall.speakerRole}</p>
        </div>
      </div>
      <div className="min-w-0">
        {!open ? <div className="notice-panel">
          <h2 className="text-2xl font-semibold text-white">This event has ended.</h2>
          <p className="mt-4 leading-7 text-slate-300">Registration is now closed. <Link className="text-link" href="/events">Explore upcoming events</Link>.</p>
        </div> : config ? <EventRegistrationForm siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} organiser={config.organiser} contact={config.contact} retention={config.retention} /> : <div className="notice-panel">
          <h2 className="text-2xl font-semibold text-white">Registration is temporarily unavailable.</h2>
          <p className="mt-4 leading-7 text-slate-300">Please try again later or <Link className="text-link" href="/contact">contact GreCyberSec</Link>.</p>
        </div>}
      </div>
    </section>
  </>;
}
