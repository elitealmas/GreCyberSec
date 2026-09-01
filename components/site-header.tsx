import Link from "next/link";
import { HeaderMemberNavigation } from "@/components/header-member-navigation";
import { NavigationLink } from "@/components/navigation-link";
import { navigation } from "@/lib/site-data";

export function SiteHeader() {
  return <header className="site-header sticky top-0 z-50"><a className="skip-link" href="#main-content">Skip to content</a><div className="site-shell flex h-18 items-center justify-between gap-5 px-3 sm:px-4">
    <Link className="site-wordmark" href="/" aria-label="GreCyberSec home">GreCyberSec</Link>
    <nav className="hidden items-center gap-5 lg:flex" aria-label="Primary navigation">{navigation.map((item) => <NavigationLink href={item.href} key={item.href}>{item.label}</NavigationLink>)}<HeaderMemberNavigation /></nav>
    <details className="relative lg:hidden"><summary className="menu-button">Menu <span aria-hidden="true">☰</span></summary><nav className="mobile-menu" aria-label="Mobile navigation">{navigation.map((item) => <NavigationLink className="nav-link block px-4 py-3" href={item.href} key={item.href}>{item.label}</NavigationLink>)}<HeaderMemberNavigation mobile /></nav></details>
  </div></header>;
}
