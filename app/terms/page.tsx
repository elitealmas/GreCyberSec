import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms and conditions", description: "Terms for using the GreCyberSec website and member learning space." };

export default function TermsPage() {
  return <LegalPage eyebrow="Terms and conditions" title="Use the learning space responsibly." intro="These terms explain the basic rules for using the GreCyberSec website, member features and community learning activities." robotLine="Oh, you’re a legal nerd. I respect a well-formed clause." sections={[
    { heading: "Using this website", children: <p>You may use this website for lawful, personal and educational purposes. Do not interfere with the site, attempt to bypass its security controls or use it in a way that prevents others from taking part.</p> },
    { heading: "Member accounts", children: <p>Keep your login details private and use accurate information when creating an account. You are responsible for activity carried out through your account; let us know through the contact page if you believe it has been used without permission.</p> },
    { heading: "Responsible security practice", children: <p>GreCyberSec activities are for authorised learning environments. Never test systems, accounts, networks or data without clear permission from their owner. Follow University of Greenwich policies and applicable law at all times.</p> },
    { heading: "Third-party services and events", children: <p>Some pages link to partner events, resources or platforms. Those services have their own terms and privacy practices. Check them before registering, sharing information or taking part.</p> },
    { heading: "Changes and questions", children: <p>We may update these terms as the society and learning space develop. Continued use after an update means you accept the revised terms. Questions can be sent through the contact page.</p> },
  ]} />;
}
