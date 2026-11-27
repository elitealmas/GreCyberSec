export type CommitteeMember = { role: string; name: string; focus: string; linkedin: string; term: string };

export const committee: CommitteeMember[] = [
  { role: "President", name: "Mohammed Akkalath", focus: "Society direction and university liaison", linkedin: "https://www.linkedin.com/in/akkalathmohammedalmas/", term: "Jan 2025 – Present" },
  { role: "Vice President", name: "Isaam Imraan", focus: "Events and member experience", linkedin: "https://www.linkedin.com/in/mohammad-isaam-imran-290444328?skipRedirect=true", term: "Jan 2025 – Present" },
  { role: "Treasurer", name: "Samay Paroha", focus: "Society finances and member support", linkedin: "https://www.linkedin.com/in/samay-paroha/", term: "Sept 2026 – Present" },
  { role: "Social Media Manager", name: "Md Ammar Ahmed", focus: "Society social media and online communications", linkedin: "https://www.linkedin.com/in/md-ammar-ahmed-206868248/", term: "Sept 2026 – Present" },
];

export const navigation = [
  { href: "/about", label: "About" },
  { href: "/events", label: "Events" },
  { href: "/projects", label: "Projects" },
  { href: "/people", label: "People" },
  { href: "/contact", label: "Contact" },
];
