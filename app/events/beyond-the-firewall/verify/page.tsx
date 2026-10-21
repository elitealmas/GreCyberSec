import type { Metadata } from "next";
import { connection } from "next/server";
import { EventVerification } from "@/components/event-verification";
import { PageHero } from "@/components/page-hero";
import { calendarLinks, eventIsOpen } from "@/lib/beyond-firewall";
import { eventPublicConfig, eventRegistrationConfig } from "@/lib/event-registration-server";

export const metadata: Metadata = { title: "Verify event registration", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const maxDuration = 60;

export default async function VerifyEventPage() {
  await connection();
  const event = eventPublicConfig();
  const config = eventRegistrationConfig();
  return <>
    <PageHero eyebrow="Beyond the Firewall" title="Verify your email."><p>Confirm your registration for the guest speaker session.</p></PageHero>
    <section className="site-shell py-16 sm:py-24">
      <div className="max-w-3xl"><EventVerification open={eventIsOpen(event.end)} links={config ? calendarLinks(config.start, config.end, config.siteUrl) : null} /></div>
    </section>
  </>;
}
