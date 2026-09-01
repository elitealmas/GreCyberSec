"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { MemberMenu } from "@/components/member-menu";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function HeaderMemberNavigation({ mobile = false }: { mobile?: boolean }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = createClient();
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.user));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session?.user)));

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!signedIn) return mobile ? <Link className="nav-login m-3" href="/login">Log in</Link> : <Link className="nav-login" href="/login">Log in</Link>;

  if (mobile) {
    return <><Link className="nav-link block px-4 py-3" href="/dashboard">Dashboard</Link><form action={logout}><FormSubmitButton className="nav-login m-3" pendingLabel="Signing out…">Sign out</FormSubmitButton></form></>;
  }

  return <><Link className="nav-link" href="/dashboard">Dashboard</Link><MemberMenu /></>;
}
