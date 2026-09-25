import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Cookie policy", description: "How GreCyberSec uses cookies and local browser storage." };

export default function CookiesPage() {
  return <LegalPage eyebrow="Cookie policy" title="Small files. Serious purpose." intro="Cookies and browser storage help the member area work securely and remember your display preference." robotLine="Cookie audit complete. No crumbs in the keyboard, please." sections={[
    { heading: "Essential session cookies", children: <p>When you sign in, Supabase uses essential session cookies to keep your account authenticated and to protect the member area. These cookies are needed for sign-in and account security.</p> },
    { heading: "Display preference", children: <p>The website stores your chosen dark or light theme in your browser&apos;s local storage. This preference stays on your device and lets the website restore your chosen appearance.</p> },
    { heading: "Security verification", children: <p>Cloudflare Turnstile is shown on sign-in and registration forms to help prevent automated abuse. Cloudflare may use cookies or similar technologies as part of that security check.</p> },
    { heading: "No advertising cookies", children: <p>GreCyberSec does not intentionally use advertising or analytics cookies. External services linked from this site may have their own cookies and privacy practices.</p> },
    { heading: "Managing cookies", children: <p>You can control or delete cookies through your browser settings. Blocking essential cookies may prevent account features from working correctly; clearing local storage will reset your theme preference.</p> },
  ]} />;
}
