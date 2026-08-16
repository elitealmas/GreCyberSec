import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Email confirmed", robots: { index: false, follow: false } };

export default function ConfirmedPage() {
  return <AuthShell eyebrow="Email confirmation" title="Your email has been confirmed."><div className="auth-message auth-message-success mt-6" role="status"><p>Thanks for confirming your email address. Your GreCyberSec account is ready to use.</p></div><div className="mt-8"><Link className="button button-primary" href="/dashboard">Go to dashboard <span aria-hidden="true">→</span></Link></div></AuthShell>;
}
