import type { ReactNode } from "react";
import { WindowTitlebar } from "@/components/window-titlebar";

function AuthWindow({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <div className="window w-full max-w-xl"><WindowTitlebar title={eyebrow} /><div className="window-body"><h1 className="text-3xl tracking-tight text-heading sm:text-4xl">{title}</h1>{children}</div></div>;
}

export function AuthShell({ eyebrow, title, children, aside }: { eyebrow: string; title: string; children: ReactNode; aside?: ReactNode }) {
  if (aside) {
    return <section className="site-shell auth-layout min-h-[calc(100vh-22rem)] py-16 sm:py-24"><AuthWindow eyebrow={eyebrow} title={title}>{children}</AuthWindow>{aside}</section>;
  }

  return <section className="site-shell grid min-h-[calc(100vh-22rem)] place-items-center py-16 sm:py-24"><AuthWindow eyebrow={eyebrow} title={title}>{children}</AuthWindow></section>;
}
