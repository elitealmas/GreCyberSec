import Link from "next/link";
import type { ReactNode } from "react";

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" | "text" }) {
  const styles = variant === "primary" ? "button button-primary" : variant === "secondary" ? "button button-secondary" : "text-link";
  return <Link href={href} className={styles}>{children}<span aria-hidden="true"> →</span></Link>;
}
