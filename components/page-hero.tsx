import type { ReactNode } from "react";

export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <section className="page-hero"><div className="site-shell py-16 sm:py-24">
    <p className="eyebrow">{eyebrow}</p><h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{title}</h1>
    <div className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{children}</div>
  </div></section>;
}
