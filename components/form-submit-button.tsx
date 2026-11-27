"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { RetroLoader } from "@/components/retro-loader";

export function FormSubmitButton({ children, pendingLabel, className = "button button-primary", disabled = false }: { children: ReactNode; pendingLabel: string; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={disabled || pending}>{pending ? <RetroLoader size="small" label={pendingLabel} /> : children}</button>;
}
