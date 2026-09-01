import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { MemberMenu } from "@/components/member-menu";
import { NavigationLink } from "@/components/navigation-link";
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

  const memberNavigation = signedIn ? <><Link className="nav-link" href="/dashboard">Dashboard</Link><MemberMenu /></> : <Link className="nav-login" href="/login">Log in</Link>;

  return <header className="site-header sticky top-0 z-50"><a className="skip-link" href="#main-content">Skip to content</a><div className="site-shell flex h-18 items-center justify-between gap-5 px-3 sm:px-4">
    <Link className="site-wordmark" href="/" aria-label="GreCyberSec home">GreCyberSec</Link>
    <nav className="hidden items-center gap-5 lg:flex" aria-label="Primary navigation">{navigation.map((item) => <NavigationLink href={item.href} key={item.href}>{item.label}</NavigationLink>)}{memberNavigation}</nav>
    <details className="relative lg:hidden"><summary className="menu-button">Menu <span aria-hidden="true">☰</span></summary><nav className="mobile-menu" aria-label="Mobile navigation">{navigation.map((item) => <NavigationLink className="nav-link block px-4 py-3" href={item.href} key={item.href}>{item.label}</NavigationLink>)}{signedIn ? <><NavigationLink className="nav-link block px-4 py-3" href="/dashboard">Dashboard</NavigationLink><form action={logout}><FormSubmitButton className="nav-login m-3" pendingLabel="Signing out…">Sign out</FormSubmitButton></form></> : <Link className="nav-login m-3" href="/login">Log in</Link>}</nav></details>
  </div></header>;
}
