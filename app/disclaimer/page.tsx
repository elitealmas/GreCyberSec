import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Disclaimer", description: "Important information about GreCyberSec website content and external resources." };

export default function DisclaimerPage() {
  return <LegalPage eyebrow="Disclaimer" title="Good advice needs context." intro="GreCyberSec shares educational information for a student community. Please use it thoughtfully and seek qualified advice where needed." robotLine="I am a robot, not a solicitor. That is definitely a disclaimer." sections={[
    { heading: "Educational information", children: <p>Website content, courses and community materials are provided for general educational purposes. They are not professional legal, financial, medical, security or other specialist advice.</p> },
    { heading: "Security content", children: <p>Security techniques should only be practised in authorised environments. You are responsible for making sure your actions are lawful, ethical and permitted before using anything you learn here.</p> },
    { heading: "External links", children: <p>Links to partner events, tools and external resources are provided for convenience. GreCyberSec does not control those sites and is not responsible for their content, availability or practices.</p> },
    { heading: "Accuracy and availability", children: <p>We aim to keep information useful and current, but cannot guarantee that every item is complete, accurate or always available. Check important details with the relevant provider before relying on them.</p> },
  ]} />;
}
