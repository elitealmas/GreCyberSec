import type { CommitteeMember } from "@/lib/site-data";
import { RetroMonitor } from "@/components/retro-monitor";

export function CommitteeCard({ member }: { member: CommitteeMember }) {
  return <article className="card h-full" data-title={`${member.role.toUpperCase()}.EXE`}><RetroMonitor /><p className="mt-5 eyebrow">{member.role}</p><p className="term-badge mt-3"><span className="sr-only">In role: </span>{member.term}</p><h3 className="mt-2 text-xl font-semibold text-heading">{member.name}</h3><a className="text-link mt-3 w-fit" href={member.linkedin} target="_blank" rel="noreferrer">LinkedIn <span aria-hidden="true">↗</span></a><p className="mt-3 text-body">{member.focus}</p></article>;
}
