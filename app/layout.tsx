import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: { default: "GreCyberSec | University of Greenwich", template: "%s | GreCyberSec" },
  description: "GreCyberSec is the cybersecurity society at the University of Greenwich.",
  robots: { index: true, follow: true },
  icons: { icon: "/images/grecybersec-logo.jpg" },
  openGraph: { type: "website", siteName: "GreCyberSec", title: "GreCyberSec", description: "Cybersecurity Society — University of Greenwich" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();

  return <html lang="en-GB"><body><SiteHeader /><main id="main-content">{children}</main><SiteFooter /></body></html>;
}
