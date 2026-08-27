import type { CommitteeMember } from "@/lib/site-data";
import { CommitteeRobot } from "@/components/committee-robot";

export function CommitteeCard({ member }: { member: CommitteeMember }) {
  return <article className="card h-full"><CommitteeRobot /><p className="mt-5 eyebrow">{member.role}</p><h3 className="mt-2 text-xl font-semibold text-white">{member.name}</h3><a className="text-link mt-3 w-fit" href={member.linkedin} target="_blank" rel="noreferrer">LinkedIn <span aria-hidden="true">↗</span></a><p className="mt-3 text-slate-300">{member.focus}</p></article>;
}
