import type { Metadata } from "next";
import { CommitteeCard } from "@/components/cards";
import { PageHero } from "@/components/page-hero";
import { committee } from "@/lib/site-data";
export const metadata: Metadata = { title: "Committee" };
export default function CommitteePage() { return <><PageHero eyebrow="Committee" title="The people building GreCyberSec."><p>Meet the committee coordinating the society, its members and upcoming activity.</p></PageHero><section className="site-shell py-16 sm:py-24"><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{committee.map((member) => <CommitteeCard member={member} key={member.role} />)}</div></section></> }
