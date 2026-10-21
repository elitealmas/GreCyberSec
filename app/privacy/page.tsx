import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy notice", description: "How GreCyberSec handles information connected with the website and member learning space." };

export default function PrivacyPage() {
  return <LegalPage eyebrow="Privacy notice" title="Your data deserves good security too." intro="This notice describes the information used for GreCyberSec accounts, learning features and event registration, and how to ask us about it." robotLine="I only collect the bits I need. My storage compartments are tiny." sections={[
    { heading: "Information we use", children: <p>When you create a member account, we use your email address and account credentials. When you use learning features, we store course progress, quiz attempts and related account information so that the learning space can work.</p> },
    { heading: "Why we use it", children: <p>We use this information to provide and secure accounts, show your learning progress, respond to requests and maintain the website. We do not sell personal information or use it for advertising.</p> },
    { heading: "Event registration", children: <p>For Beyond the Firewall, we collect your full name, email address and Yes or No photography preference. We use these details to verify your email, confirm your place, administer attendance and respect your photography choice. Choosing No does not prevent registration or attendance. We store verification and email-delivery status to operate the registration process. The event registration notice states the retention period: by default, records are scheduled for deletion seven days after the event. Unverified registrations and expired verification links are cleared sooner. Service-provider backups and operational logs may follow separate retention periods. See the <Link className="text-link" href="/events/beyond-the-firewall#registration">event registration notice</Link> for the period configured for this event.</p> },
    { heading: "Service providers", children: <p>Supabase stores account, learning and event registration data. Resend sends event verification and confirmation emails. Vercel hosts the website. Cloudflare Turnstile helps protect sign-in and registration forms from abuse. These providers may process technical information needed to deliver and secure their services.</p> },
    { heading: "Your choices", children: <p>You can ask about your GreCyberSec account or event registration information, request corrections or deletion, and update or withdraw your photography consent through the <Link className="text-link" href="/contact">contact page</Link>. We may need to verify your identity before handling a request.</p> },
    { heading: "Keeping this notice current", children: <p>We will update this notice when the website or its data practices change. For questions about this notice or your information, contact the society through this website.</p> },
  ]} />;
}
