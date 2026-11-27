import type { ReactNode } from "react";
import { RetroMonitor } from "@/components/retro-monitor";
import { PageHero } from "@/components/page-hero";

type LegalSection = {
  heading: string;
  children: ReactNode;
};

export function LegalPage({ eyebrow, title, intro, robotLine, sections }: { eyebrow: string; title: string; intro: string; robotLine: string; sections: readonly LegalSection[] }) {
  return <><PageHero eyebrow={eyebrow} title={title}><p>{intro}</p></PageHero><section className="site-shell grid gap-8 py-16 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start sm:py-24"><div className="grid gap-5">{sections.map((section) => <article className="card" data-title={section.heading} key={section.heading}><h2 className="text-xl font-semibold tracking-tight text-heading">{section.heading}</h2><div className="legal-copy mt-3 text-body">{section.children}</div></article>)}</div><aside className="legal-robot-card" data-title="Compliance companion"><RetroMonitor /><div><p className="eyebrow">Compliance companion</p><p className="mt-3 text-lg font-semibold leading-7 text-heading">{robotLine}</p><p className="mt-3 text-sm leading-6 text-body">The serious details are above. The terminal is just here to keep the small print friendly.</p></div></aside></section><section className="section-alt"><div className="site-shell py-8 text-sm text-muted">Last updated: 25 September 2026</div></section></>;
}
