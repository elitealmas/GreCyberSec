import type { Metadata } from "next";
import { WorkshopCard } from "@/components/cards";
import { PageHero } from "@/components/page-hero";
import { workshops } from "@/lib/site-data";
export const metadata: Metadata = { title: "Workshops" };
export default function WorkshopsPage() { return <><PageHero eyebrow="Workshops" title="Build practical security skills."><p>Sessions are structured to be useful, ethical and confidence-building. No prior experience should prevent you from joining a beginner workshop.</p></PageHero><section className="site-shell py-16 sm:py-24"><div className="grid gap-5 md:grid-cols-2">{workshops.map((workshop) => <WorkshopCard workshop={workshop} key={workshop.title} />)}</div></section></> }
