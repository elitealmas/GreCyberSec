export function SectionHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return <div className="max-w-3xl">
    <p className="eyebrow">{eyebrow}</p>
    <h2 className="mt-3 text-3xl font-semibold tracking-tight text-heading sm:text-4xl">{title}</h2>
    {intro && <p className="mt-4 text-lg leading-8 text-body">{intro}</p>}
  </div>;
}
