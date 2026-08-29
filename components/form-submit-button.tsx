"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { RobotLoader } from "@/components/robot-loader";

export function FormSubmitButton({ children, pendingLabel, className = "button button-primary", disabled = false }: { children: ReactNode; pendingLabel: string; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={disabled || pending}>{pending ? <RobotLoader size="small" label={pendingLabel} /> : children}</button>;
}
