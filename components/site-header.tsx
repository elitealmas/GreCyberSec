import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { BrandMark } from "@/components/brand-mark";
import { navigation } from "@/lib/site-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  let signedIn = false;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getClaims();
      signedIn = !error && Boolean(data?.claims);
    } catch {
      signedIn = false;
    }
  }

  const memberNavigation = signedIn ? <><Link className="nav-link" href="/dashboard">Dashboard</Link><form action={logout}><button className="nav-login" type="submit">Sign out</button></form></> : <Link className="nav-login" href="/login">Log in</Link>;

  return <header className="site-header sticky top-0 z-50"><a className="skip-link" href="#main-content">Skip to content</a><div className="site-shell flex h-18 items-center justify-between gap-5">
    <Link className="flex items-center gap-3 text-white" href="/" aria-label="GreCyberSec home"><BrandMark /><span><strong className="block text-sm tracking-wide">GreCyberSec</strong><span className="block text-[11px] text-slate-400">University of Greenwich</span></span></Link>
    <nav className="hidden items-center gap-5 lg:flex" aria-label="Primary navigation">{navigation.map((item) => <Link className="nav-link" href={item.href} key={item.href}>{item.label}</Link>)}{memberNavigation}</nav>
    <details className="relative lg:hidden"><summary className="menu-button">Menu <span aria-hidden="true">☰</span></summary><nav className="mobile-menu" aria-label="Mobile navigation">{navigation.map((item) => <Link className="nav-link block px-4 py-3" href={item.href} key={item.href}>{item.label}</Link>)}{signedIn ? <><Link className="nav-link block px-4 py-3" href="/dashboard">Dashboard</Link><form action={logout}><button className="nav-login m-3" type="submit">Sign out</button></form></> : <Link className="nav-login m-3" href="/login">Log in</Link>}</nav></details>
  </div></header>;
}
