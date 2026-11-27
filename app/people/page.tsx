import type { Metadata } from "next";
import { CommitteeCard } from "@/components/cards";
import { PageHero } from "@/components/page-hero";
import { committee } from "@/lib/site-data";
export const metadata: Metadata = { title: "People" };
export default function PeoplePage() { return <><PageHero eyebrow="People" title="The people building GreCyberSec."><p>Meet the committee running the society, and how long each of them has been at the controls.</p></PageHero><section className="site-shell py-16 sm:py-24"><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{committee.map((member) => <CommitteeCard member={member} key={member.role} />)}</div></section></> }
