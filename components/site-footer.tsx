import Link from "next/link";
import Image from "next/image";
import { BrandMark } from "@/components/brand-mark";
import { navigation } from "@/lib/site-data";

export function SiteFooter() {
  return <footer className="site-footer"><div className="site-shell grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr_.8fr]">
    <div><div className="flex items-center gap-3"><BrandMark /><div><p className="font-semibold text-white">GreCyberSec</p><p className="text-sm text-slate-400">Cybersecurity Society · University of Greenwich</p></div></div><p className="mt-5 max-w-md text-sm leading-6 text-slate-400">A student community for learning, practising and discussing cybersecurity responsibly.</p></div>
    <div><h2 className="text-sm font-semibold text-white">Explore</h2><ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2">{navigation.map((item) => <li key={item.href}><Link className="footer-link" href={item.href}>{item.label}</Link></li>)}</ul></div>
    <div><h2 className="text-sm font-semibold text-white">Connect</h2><ul className="mt-4 space-y-2 text-sm"><li><Link className="footer-link" href="/contact">Contact the society</Link></li><li><span className="text-slate-500">LinkedIn · coming soon</span></li><li><span className="text-slate-500">Discord · coming soon</span></li></ul></div>
    <div><h2 className="text-sm font-semibold text-white">University of Greenwich</h2><div className="university-logo mt-4"><Image src="/images/university-of-greenwich-logo.png" alt="University of Greenwich" width={900} height={361} sizes="(min-width: 1024px) 13rem, 11rem" /></div></div>
  </div><div className="site-shell border-t border-[#76905a]/40 py-5 text-xs text-slate-500">© {new Date().getFullYear()} GreCyberSec. Student-led at the University of Greenwich.</div></footer>;
}
