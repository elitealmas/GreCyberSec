import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
export const metadata: Metadata = { title: "Projects" };
export default function ProjectsPage() { return <><PageHero eyebrow="Projects" title="Projects are coming soon."><p>We are preparing the GreCyberSec project programme and will publish approved opportunities here.</p></PageHero><section className="site-shell py-16 sm:py-24"><article className="notice-panel max-w-2xl"><p className="eyebrow">Coming soon</p><h2 className="mt-3 text-2xl font-semibold text-white">Project details will appear here.</h2><p className="mt-4 leading-7 text-slate-300">There are no sample projects listed while the programme is being finalised.</p></article></section></> }
