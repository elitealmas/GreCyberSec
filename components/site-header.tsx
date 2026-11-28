import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { logout } from "@/app/auth/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { MemberMenu } from "@/components/member-menu";
import { MobileMenu } from "@/components/mobile-menu";
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

  const memberNavigation = signedIn ? <><NavigationLink href="/dashboard">Dashboard</NavigationLink><MemberMenu /></> : <Link className="nav-login" href="/login">Log in</Link>;

  return <header className="site-header"><a className="skip-link" href="#main-content">Skip to content</a><div className="site-shell flex h-14 items-center justify-between gap-4">
    <Link className="site-wordmark" href="/" aria-label="GreCyberSec home"><BrandMark />GreCyberSec</Link>
    <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">{navigation.map((item) => <NavigationLink href={item.href} key={item.href}>{item.label}</NavigationLink>)}{memberNavigation}</nav>
    <MobileMenu><nav className="mobile-menu" aria-label="Mobile navigation">{navigation.map((item) => <NavigationLink className="nav-link block" href={item.href} key={item.href}>{item.label}</NavigationLink>)}{signedIn ? <><NavigationLink className="nav-link block" href="/dashboard">Dashboard</NavigationLink><form action={logout}><FormSubmitButton className="nav-login m-3" pendingLabel="Signing out…">Sign out</FormSubmitButton></form></> : <NavigationLink className="nav-login m-3" href="/login">Log in</NavigationLink>}</nav></MobileMenu>
  </div></header>;
}
