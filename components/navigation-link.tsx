"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavigationLink({ href, children, className = "nav-link" }: { href: string; children: ReactNode; className?: string }) {
  const pathname = usePathname();
  const isCurrent = href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return <Link className={className} href={href} aria-current={isCurrent ? "page" : undefined}>{children}</Link>;
}
