import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
export const metadata: Metadata = { title: "Resources" };
export default function ResourcesPage() { return <><PageHero eyebrow="Resources" title="Resources are coming soon."><p>We are preparing a reviewed GreCyberSec resource library for members.</p></PageHero><section className="site-shell py-16 sm:py-24"><article className="notice-panel max-w-2xl"><p className="eyebrow">Coming soon</p><h2 className="mt-3 text-2xl font-semibold text-white">Resource details will appear here.</h2><p className="mt-4 leading-7 text-slate-300">There are no sample resources listed while the library is being finalised.</p></article></section></> }
