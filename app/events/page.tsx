import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
export const metadata: Metadata = { title: "Events", description: "Upcoming GreCyberSec events at the University of Greenwich." };

const events = [
  {
    title: "Monad Metropolis Hacker House – London",
    type: "Builder event · Hackathon · Technology",
    description: "Meet other builders, turn ideas into projects and take part in a hands-on London hacker-house experience.",
    registrationUrl: "https://luma.com/metropolis-lon-oct-2026?tk=YMB9AI",
  },
  {
    title: "Encode London 2026",
    type: "Technology event · Hackathon · Community",
    description: "Connect with the wider tech community through an Encode London event built around learning, collaboration and new ideas.",
    registrationUrl: "https://luma.com/encode-london-2026?tk=gZBVvx",
  },
] as const;

export default function EventsPage() {
  return <><PageHero eyebrow="Events" title="Build with the wider tech community."><p>Discover upcoming opportunities to meet other builders, learn new skills and take part in technology events with GreCyberSec and our partners.</p></PageHero><section className="site-shell py-16 sm:py-24"><div className="max-w-3xl"><p className="eyebrow">Upcoming opportunities</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Join us beyond the classroom.</h2><p className="mt-4 leading-7 text-slate-300">Registration is managed by our event partners. Each link opens in a new tab.</p></div><div className="mt-10 grid gap-5 md:grid-cols-2">{events.map((event) => <article className="card event-card flex h-full flex-col" key={event.registrationUrl}><p className="pill">{event.type}</p><h3 className="mt-5 text-2xl font-semibold tracking-tight text-white">{event.title}</h3><p className="mt-4 flex-1 leading-7 text-slate-300">{event.description}</p><div className="mt-7"><a className="button button-primary w-fit" href={event.registrationUrl} target="_blank" rel="noopener noreferrer">Register now <span aria-hidden="true">↗</span></a></div></article>)}</div></section></>;
}
