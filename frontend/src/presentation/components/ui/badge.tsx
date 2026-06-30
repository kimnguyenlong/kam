import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[var(--radius-sm)] font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.02em] whitespace-nowrap border",
  {
    variants: {
      tone: {
        neutral:
          "bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[var(--border-default)]",
        accent:
          "bg-[var(--accent-muted)] text-[var(--tan-500)] border-[var(--border-accent)]",
        success: "bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/30",
        warning: "bg-[var(--warning-muted)] text-[var(--warning)] border-[var(--warning)]/30",
        danger: "bg-[var(--danger-muted)] text-[var(--danger)] border-[var(--danger)]/30",
        info: "bg-[var(--info-muted)] text-[var(--info)] border-[var(--info)]/30",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export { badgeVariants };
