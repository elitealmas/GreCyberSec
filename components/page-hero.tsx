import type { ReactNode } from "react";
import { WindowTitlebar } from "@/components/window-titlebar";

export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <section className="page-hero"><div className="site-shell">
    <div className="window page-hero-inner"><WindowTitlebar title={eyebrow} />
      <div className="window-body"><h1 className="max-w-4xl text-4xl tracking-tight text-heading sm:text-6xl">{title}</h1>
      <div className="mt-6 max-w-2xl text-lg leading-8 text-body">{children}</div></div>
    </div>
  </div></section>;
}
