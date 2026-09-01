"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { FormSubmitButton } from "@/components/form-submit-button";

const THEME_KEY = "grecybersec-theme";
const CURSOR_TRAIL_KEY = "grecybersec-cursor-trail";
const DEFAULT_PREFERENCES = "dark:on";

function readPreferences() {
  return `${window.localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"}:${window.localStorage.getItem(CURSOR_TRAIL_KEY) === "off" ? "off" : "on"}`;
}

function subscribeToPreferences(callback: () => void) {
  const update = () => callback();
  window.addEventListener("storage", update);
  window.addEventListener("grecybersec:preferences", update);
  return () => {
    window.removeEventListener("storage", update);
    window.removeEventListener("grecybersec:preferences", update);
  };
}

function applyPreferences(preferences = readPreferences()) {
  const [theme, trail] = preferences.split(":");
  document.documentElement.classList.toggle("theme-light", theme === "light");
  document.documentElement.classList.toggle("cursor-trail-disabled", trail === "off");
}

export function AppearancePreferences() {
  useEffect(() => {
    applyPreferences();
  }, []);

  return null;
}

export function MemberMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const preferences = useSyncExternalStore(subscribeToPreferences, readPreferences, () => DEFAULT_PREFERENCES);
  const [theme, trail] = preferences.split(":");
  const darkMode = theme === "dark";
  const cursorTrail = trail === "on";

  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    function closeOnOutsidePress(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function toggleDarkMode() {
    const nextDarkMode = !darkMode;
    window.localStorage.setItem(THEME_KEY, nextDarkMode ? "dark" : "light");
    window.dispatchEvent(new Event("grecybersec:preferences"));
  }

  function toggleCursorTrail() {
    const nextCursorTrail = !cursorTrail;
    window.localStorage.setItem(CURSOR_TRAIL_KEY, nextCursorTrail ? "on" : "off");
    window.dispatchEvent(new Event("grecybersec:preferences"));
  }

  return <div className="member-menu" ref={menuRef}>
    <button aria-controls="member-menu-panel" aria-expanded={open} aria-haspopup="menu" className="member-menu-trigger" onClick={() => setOpen((current) => !current)} type="button">
      <span className="member-menu-robot" aria-hidden="true"><i /><b><em /><em /></b><strong /></span>
      <span className="sr-only">Open account menu</span>
    </button>
    <div className={open ? "member-menu-panel member-menu-panel-open" : "member-menu-panel"} id="member-menu-panel" role="menu">
      <p className="member-menu-title">Member controls</p>
      <Link className="member-menu-link" href="/dashboard" onClick={() => setOpen(false)} role="menuitem">Dashboard <span aria-hidden="true">→</span></Link>
      <div className="member-menu-preferences" aria-label="Display preferences">
        <button aria-checked={darkMode} className="member-menu-option" onClick={toggleDarkMode} role="switch" type="button"><span>Dark mode</span><i className={darkMode ? "preference-toggle preference-toggle-on" : "preference-toggle"} aria-hidden="true"><b /></i></button>
        <button aria-checked={cursorTrail} className="member-menu-option" onClick={toggleCursorTrail} role="switch" type="button"><span>Cursor trail</span><i className={cursorTrail ? "preference-toggle preference-toggle-on" : "preference-toggle"} aria-hidden="true"><b /></i></button>
      </div>
      <form action={logout} className="member-menu-signout"><FormSubmitButton className="member-menu-signout-button" pendingLabel="Signing out…">Sign out <span aria-hidden="true">→</span></FormSubmitButton></form>
    </div>
  </div>;
}
