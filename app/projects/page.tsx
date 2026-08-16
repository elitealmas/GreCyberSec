import type { Metadata } from "next";
import { ProjectCard } from "@/components/cards";
import { PageHero } from "@/components/page-hero";
import { projects } from "@/lib/site-data";
export const metadata: Metadata = { title: "Projects" };
export default function ProjectsPage() { return <><PageHero eyebrow="Projects" title="Small projects. Real questions."><p>GreCyberSec projects make room for focused inquiry, useful documentation and collaboration across student interests.</p></PageHero><section className="site-shell py-16 sm:py-24"><div className="grid gap-5 md:grid-cols-3">{projects.map((project) => <ProjectCard project={project} key={project.title} />)}</div><aside className="notice-panel mt-10"><h2 className="text-xl font-semibold text-white">Have a project idea?</h2><p className="mt-3 text-slate-300">We’re interested in research, tools, educational content and community initiatives that improve security without creating risk.</p></aside></section></> }
