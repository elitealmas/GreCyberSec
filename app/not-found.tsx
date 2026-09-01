import Link from "next/link";

export default function NotFound() {
  return <section className="site-shell grid min-h-[calc(100vh-22rem)] place-items-center py-16 sm:py-24">
    <article className="notice-panel w-full max-w-2xl text-center">
      <p className="eyebrow">Error 404 · Route unavailable</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">This page is off the network.</h1>
      <p className="mx-auto mt-5 max-w-xl leading-7 text-slate-300">The page may have moved, or the address may not be correct. Head back to the GreCyberSec home page to continue.</p>
      <div className="mt-8"><Link className="button button-primary" href="/">Return home <span aria-hidden="true">→</span></Link></div>
    </article>
  </section>;
}
