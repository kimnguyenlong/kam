"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// K Labs action control. Primary = tan accent with soft glow; restrained radii,
// hairline borders, calm mechanical transitions.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-medium tracking-[-0.005em] select-none transition-[color,background-color,border-color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--accent-base)] text-[var(--accent-foreground)] border border-transparent shadow-[var(--glow-accent)] hover:bg-[var(--accent-strong)]",
        secondary:
          "bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--surface-hover)]",
        ghost:
          "bg-transparent text-[var(--text-secondary)] border border-transparent hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
        outline:
          "bg-transparent text-[var(--text-primary)] border border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
        danger:
          "bg-[var(--danger)] text-[#1a0608] border border-transparent hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3 text-[13px] [&_svg]:size-4",
        md: "h-10 px-4 text-[15px] [&_svg]:size-[18px]",
        lg: "h-12 px-[22px] text-[18px] [&_svg]:size-5",
        icon: "h-10 w-10 [&_svg]:size-[18px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
