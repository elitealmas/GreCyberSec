import type { CommitteeMember, Event, Project, Workshop } from "@/lib/site-data";

export function EventCard({ event }: { event: Event }) {
  return <article className="card flex h-full flex-col"><p className="eyebrow">{event.date}</p><h3 className="mt-3 text-xl font-semibold text-white">{event.title}</h3><p className="mt-3 flex-1 text-slate-300">{event.description}</p><dl className="mt-6 space-y-2 border-t border-white/10 pt-4 text-sm text-slate-300"><div className="flex justify-between gap-4"><dt>Time</dt><dd>{event.time}</dd></div><div className="flex justify-between gap-4"><dt>Where</dt><dd className="text-right">{event.location}</dd></div><div className="flex justify-between gap-4"><dt>Format</dt><dd>{event.format}</dd></div></dl></article>;
}

export function WorkshopCard({ workshop }: { workshop: Workshop }) {
  return <article className="card h-full"><div className="flex items-start justify-between gap-3"><p className="eyebrow">{workshop.level}</p><span className="pill">{workshop.duration}</span></div><h3 className="mt-3 text-xl font-semibold text-white">{workshop.title}</h3><p className="mt-3 text-slate-300">{workshop.description}</p><ul className="mt-5 flex flex-wrap gap-2" aria-label="Workshop topics">{workshop.topics.map((topic) => <li className="pill" key={topic}>{topic}</li>)}</ul></article>;
}

export function ProjectCard({ project }: { project: Project }) {
  return <article className="card h-full"><div className="flex items-center justify-between gap-3"><p className="eyebrow">{project.area}</p><span className="pill">{project.status}</span></div><h3 className="mt-3 text-xl font-semibold text-white">{project.title}</h3><p className="mt-3 text-slate-300">{project.description}</p></article>;
}

export function CommitteeCard({ member }: { member: CommitteeMember }) {
  return <article className="card h-full"><div className="avatar" aria-hidden="true">{member.role.slice(0, 1)}</div><p className="mt-5 eyebrow">{member.role}</p><h3 className="mt-2 text-xl font-semibold text-white">{member.name}</h3><p className="mt-3 text-slate-300">{member.focus}</p></article>;
}
