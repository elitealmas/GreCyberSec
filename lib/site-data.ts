export type CommitteeMember = { role: string; name: string; focus: string; linkedin: string };

export const committee: CommitteeMember[] = [
  { role: "President", name: "Mohammed Akkalath", focus: "Society direction and university liaison", linkedin: "https://www.linkedin.com/in/akkalathmohammedalmas/" },
  { role: "Vice President", name: "Isaam Imraan", focus: "Events and member experience", linkedin: "https://www.linkedin.com/in/mohammad-isaam-imran-290444328?skipRedirect=true" },
  { role: "Treasurer", name: "Samay Paroha", focus: "Society finances and member support", linkedin: "https://www.linkedin.com/in/samay-paroha/" },
  { role: "Committee Member", name: "Md Ammar Ahmed", focus: "Cybersecurity undergraduate at the University of Greenwich", linkedin: "https://www.linkedin.com/in/md-ammar-ahmed-206868248/" },
];

export const navigation = [
  { href: "/about", label: "About" },
  { href: "/events", label: "Events" },
  { href: "/projects", label: "Projects" },
  { href: "/committee", label: "Committee" },
  { href: "/resources", label: "Resources" },
  { href: "/courses", label: "Courses" },
  { href: "/contact", label: "Contact" },
];
