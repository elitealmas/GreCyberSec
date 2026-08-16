import type { Metadata } from "next";
import { EventCard } from "@/components/cards";
import { PageHero } from "@/components/page-hero";
import { events } from "@/lib/site-data";
export const metadata: Metadata = { title: "Events", description: "Upcoming GreCyberSec events at the University of Greenwich." };
export default function EventsPage() { return <><PageHero eyebrow="Events" title="Conversations and practice, every term."><p>Our events range from accessible introductions to technical lab sessions. Details and joining instructions will be shared through official society channels.</p></PageHero><section className="site-shell py-16 sm:py-24"><h2 className="sr-only">Upcoming events</h2><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{events.map((event) => <EventCard event={event} key={event.title} />)}</div><p className="mt-8 max-w-2xl text-sm leading-6 text-slate-400">Event information is currently sample content. Please confirm details with the society before attending.</p></section></> }
