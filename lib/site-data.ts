export type Event = { title: string; date: string; time: string; location: string; format: string; description: string };
export type Workshop = { title: string; level: string; duration: string; description: string; topics: string[] };
export type Project = { title: string; area: string; description: string; status: string };
export type CommitteeMember = { role: string; name: string; focus: string };

export const events: Event[] = [
  { title: "Welcome & threat modelling", date: "17 September 2026", time: "18:00–19:30", location: "Greenwich Campus", format: "In person", description: "Meet the society and learn a practical way to map risks before building." },
  { title: "Cyber careers panel", date: "1 October 2026", time: "18:30–20:00", location: "Online", format: "Hybrid", description: "An honest conversation with practitioners about routes into cyber security." },
  { title: "Blue team lab night", date: "15 October 2026", time: "18:00–20:00", location: "Greenwich Campus", format: "In person", description: "A guided session on analysing alerts, evidence and incident timelines." },
];

export const workshops: Workshop[] = [
  { title: "Network security foundations", level: "Beginner", duration: "90 minutes", description: "Understand traffic, segmentation and common defensive controls.", topics: ["Protocols", "Firewalls", "Monitoring"] },
  { title: "Web application security", level: "Intermediate", duration: "2 hours", description: "Explore secure design and responsibly identify common web risks.", topics: ["OWASP", "Threat modelling", "Mitigations"] },
  { title: "Digital forensics", level: "Beginner", duration: "2 hours", description: "Preserve, examine and communicate evidence in a safe practice environment.", topics: ["Evidence", "Timelines", "Reporting"] },
  { title: "Cloud security essentials", level: "Intermediate", duration: "90 minutes", description: "Build a least-privilege mindset for cloud-hosted systems.", topics: ["Identity", "Logging", "Configuration"] },
];

export const projects: Project[] = [
  { title: "Phishing resilience study", area: "Human factors", description: "A student research project examining how clear communication can reduce risky decisions.", status: "Research" },
  { title: "Home lab hardening guide", area: "Defensive security", description: "An accessible guide to inventory, update and segment a personal practice lab.", status: "In progress" },
  { title: "Incident response playbook", area: "Operations", description: "A lightweight, reusable framework for documenting and rehearsing an incident response.", status: "Open to contributors" },
];

export const committee: CommitteeMember[] = [
  { role: "President", name: "Committee member to be announced", focus: "Society direction and university liaison" },
  { role: "Vice President", name: "Committee member to be announced", focus: "Events and member experience" },
  { role: "Technical Lead", name: "Committee member to be announced", focus: "Workshops, labs and CTF activities" },
  { role: "Communications Lead", name: "Committee member to be announced", focus: "Community updates and outreach" },
];

export const resources = [
  { title: "Learning pathways", description: "Curated starting points for networking, security fundamentals and practical skills.", tag: "Guide" },
  { title: "Responsible practice", description: "A short guide to legal, ethical and safe security research.", tag: "Essential" },
  { title: "CTF preparation", description: "Suggestions for building confidence before your first competition.", tag: "Guide" },
  { title: "Career preparation", description: "Ideas for portfolios, communities and early-career cyber opportunities.", tag: "Career" },
];

export const navigation = [
  { href: "/about", label: "About" },
  { href: "/events", label: "Events" },
  { href: "/workshops", label: "Workshops" },
  { href: "/ctf", label: "CTF" },
  { href: "/projects", label: "Projects" },
  { href: "/committee", label: "Committee" },
  { href: "/resources", label: "Resources" },
  { href: "/contact", label: "Contact" },
];
