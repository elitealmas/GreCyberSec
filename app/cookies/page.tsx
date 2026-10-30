import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Cookie policy", description: "How GreCyberSec uses cookies and local browser storage." };

export default function CookiesPage() {
  return <LegalPage eyebrow="Cookie policy" title="Small files. Serious purpose." intro="Cookies and browser storage help the member area work securely and remember your display preference. Last updated 30 October 2026." robotLine="Cookie audit complete. No crumbs in the keyboard, please." sections={[
    { heading: "Essential session cookies", children: <p>When you sign in, Supabase sets essential session cookies containing signed authentication tokens so the server can authenticate requests and refresh an expiring session. They are Secure in production, SameSite=Lax and HttpOnly. The library&apos;s maximum cookie lifetime is 400 days, but tokens rotate and signing out clears the active session. These cookies are required for member features.</p> },
    { heading: "Display preference", children: <p>The chosen dark or light theme is stored under <code>grecybersec-theme</code> in local storage. It has no automatic expiry and remains on the device until you change it, clear site data or remove it through browser settings.</p> },
    { heading: "Security verification", children: <p>Cloudflare Turnstile is shown on sign-in, registration, password-reset and private-contact forms. The response token is single-use and expires after five minutes. GreCyberSec does not configure it for advertising; Cloudflare may process short-lived technical signals needed to distinguish legitimate requests from abuse.</p> },
    { heading: "No advertising cookies", children: <p>GreCyberSec does not intentionally use advertising or analytics cookies. External services linked from this site may have their own cookies and privacy practices.</p> },
    { heading: "Managing cookies", children: <p>You can control or delete cookies through your browser settings. Blocking essential cookies may prevent account features from working correctly; clearing local storage will reset your theme preference.</p> },
  ]} />;
}
