import type { ReactNode } from "react";

export function AuthShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <section className="site-shell grid min-h-[calc(100vh-22rem)] place-items-center py-16 sm:py-24"><div className="auth-card w-full max-w-xl"><p className="eyebrow">{eyebrow}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>{children}</div></section>;
}
