import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy notice", description: "How GreCyberSec handles information connected with the website and member learning space." };

export default function PrivacyPage() {
  return <LegalPage eyebrow="Privacy notice" title="Your data deserves good security too." intro="This notice describes the information used to provide GreCyberSec accounts and learning features, and how to ask us about it." robotLine="I only collect the bits I need. My storage compartments are tiny." sections={[
    { heading: "Information we use", children: <p>When you create a member account, we use your email address and account credentials. When you use learning features, we store course progress, quiz attempts and related account information so that the learning space can work.</p> },
    { heading: "Why we use it", children: <p>We use this information to provide and secure accounts, show your learning progress, respond to requests and maintain the website. We do not sell personal information or use it for advertising.</p> },
    { heading: "Service providers", children: <p>Authentication and learning data are provided through Supabase. Cloudflare Turnstile helps protect sign-in and registration forms from abuse. These providers may process technical information needed to deliver and secure their services.</p> },
    { heading: "Your choices", children: <p>You can ask about the personal information connected with your GreCyberSec account, request corrections or ask about account deletion through the contact page. We may need to verify that a request comes from the account holder.</p> },
    { heading: "Keeping this notice current", children: <p>We will update this notice when the website or its data practices change. For questions about this notice or your information, contact the society through this website.</p> },
  ]} />;
}
