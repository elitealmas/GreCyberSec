"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Native <details> menu that also closes on an outside tap/click or the Escape key.
export function MobileMenu({ children }: { children: ReactNode }) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutsidePress(event: PointerEvent) {
      const menu = menuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.removeAttribute("open");
    }

    function closeOnEscape(event: KeyboardEvent) {
      const menu = menuRef.current;
      if (event.key !== "Escape" || !menu?.open) return;
      const focusWasInside = menu.contains(document.activeElement);
      menu.removeAttribute("open");
      if (focusWasInside) menu.querySelector("summary")?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return <details ref={menuRef} className="relative lg:hidden">
    <summary className="menu-button"><span aria-hidden="true">☰</span> Menu</summary>
    {children}
  </details>;
}
