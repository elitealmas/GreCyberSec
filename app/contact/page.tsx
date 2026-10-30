import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/page-hero";
import { PrivateContactForm } from "@/components/private-contact-form";
import { privateContactConfigured } from "@/lib/contact-server";
export const metadata: Metadata = { title: "Contact" };
export const dynamic = "force-dynamic";

export default function ContactPage() {
  const privateReady = privateContactConfigured();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return <><PageHero eyebrow="Contact" title="Join the conversation."><p>Join the community for society updates, or use the private form for account, privacy and personal enquiries.</p></PageHero><section className="site-shell grid gap-10 py-16 lg:grid-cols-[.8fr_1.2fr] lg:items-center sm:py-24"><div><p className="eyebrow">Community channel</p><h2 className="mt-3 text-3xl font-semibold text-white">Find us on WhatsApp.</h2><p className="mt-5 leading-8 text-slate-300">Use your phone’s WhatsApp camera to scan the code and join the GreCyberSec community. Do not post account details or privacy requests in the group.</p><div className="notice-block mt-8 text-sm leading-6 text-slate-300">Community chat is public to its participants. Use the private form below for anything personal.</div></div><article className="contact-qr-panel"><div className="contact-qr-label"><span className="contact-qr-indicator" aria-hidden="true" />SCAN TO JOIN · GCS COMMUNITY</div><div className="contact-qr-frame"><Image src="/images/whatsapp-group-qr.png" alt="QR code to join the GreCyberSec WhatsApp community" width={1254} height={1254} priority /></div><p className="mt-6 text-center text-sm leading-6 text-slate-300">Open WhatsApp → Camera → Scan code</p></article></section><section className="site-shell pb-20 sm:pb-28" id="privacy-request"><div className="card max-w-3xl"><p className="eyebrow">Private contact</p><h2 className="mt-3 text-3xl font-semibold text-white">Account and privacy requests.</h2><p className="mt-4 leading-7 text-slate-300">This form sends directly to the committee mailbox through Resend. It does not post your request to WhatsApp or store the message in the website database.</p>{privateReady && siteKey ? <PrivateContactForm siteKey={siteKey} /> : <div className="notice-block mt-8 text-sm leading-6 text-slate-300">Private contact is temporarily unavailable. Please try again later.</div>}</div></section></>;
}
