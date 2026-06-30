import type { ReactNode } from "react";
import { Label } from "@/presentation/components/ui/label";

/** Vertical label + control + hint/error stack used across entity forms. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <span className="text-xs text-[var(--danger)]">{error}</span>
      ) : hint ? (
        <span className="text-xs text-[var(--text-tertiary)]">{hint}</span>
      ) : null}
    </div>
  );
}
