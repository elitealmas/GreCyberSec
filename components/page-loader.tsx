import { RobotLoader } from "@/components/robot-loader";

type LoaderKind = "cards" | "lesson" | "quiz" | "plain";

export function PageLoader({ label, detail, kind = "plain" }: { label: string; detail?: string; kind?: LoaderKind }) {
  return <section className="site-shell page-loader min-h-[calc(100vh-22rem)] py-16 sm:py-24">
    <div className="page-loader-status"><RobotLoader size="large" label={label} />{detail && <p>{detail}</p>}</div>
    {kind === "cards" && <div className="page-loader-grid" aria-hidden="true"><div /><div /><div /></div>}
    {kind === "lesson" && <div className="page-loader-lesson" aria-hidden="true"><span /><span /><span /><span /></div>}
    {kind === "quiz" && <div className="page-loader-quiz" aria-hidden="true"><span /><span /><span /></div>}
  </section>;
}
