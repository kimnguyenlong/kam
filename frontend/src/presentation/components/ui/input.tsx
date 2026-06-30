import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-inset)] px-3 py-2 text-[15px] text-[var(--text-primary)] shadow-[var(--shadow-inset)] transition-colors duration-[var(--duration-fast)] placeholder:text-[var(--text-tertiary)] focus-visible:border-[var(--border-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-base)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
