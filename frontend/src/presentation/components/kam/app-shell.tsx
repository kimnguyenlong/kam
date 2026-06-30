"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Boxes,
  ChevronRight,
  FileStack,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/presentation/components/ui/badge";

const NAV: { href: string; label: string; icon: typeof Activity }[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/resource-types", label: "Resource Types", icon: Boxes },
  { href: "/items", label: "Items", icon: FileStack },
  { href: "/conditions", label: "Conditions", icon: SlidersHorizontal },
  { href: "/roles", label: "Roles", icon: ShieldCheck },
  { href: "/users", label: "Users", icon: Users },
  { href: "/playground", label: "Playground", icon: ListChecks },
  { href: "/expand", label: "Expand", icon: Activity },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-default)]">
      <div className="flex items-center gap-2.5 px-5 pb-3.5 pt-[18px]">
        <div className="flex size-[30px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-base)] font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--accent-foreground)] shadow-[var(--glow-accent)]">
          K
        </div>
        <span className="font-[family-name:var(--font-display)] text-[17px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
          KAM
        </span>
        <Badge tone="neutral" className="ml-0.5">
          console
        </Badge>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const on = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors",
                on
                  ? "bg-[var(--accent-muted)] text-[var(--tan-500)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
              )}
            >
              <Icon className="size-[17px]" strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[var(--border-subtle)] p-3">
        <p className="kl-eyebrow px-2">// rbac + abac</p>
        <p className="mt-1 px-2 text-xs text-[var(--text-tertiary)]">
          Keto-backed reachability, Go ABAC overlay.
        </p>
      </div>
    </aside>
  );
}

function Topbar({ pathname }: { pathname: string }) {
  const current = NAV.find((n) => isActive(pathname, n.href))?.label ?? "Overview";
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[rgba(249,248,246,0.88)] px-6 backdrop-blur-md">
      <div className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[13px] text-[var(--text-tertiary)]">
        <span>kam</span>
        <ChevronRight className="size-3.5" />
        <span className="text-[var(--text-primary)]">{current}</span>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface-base)]">
      <Sidebar pathname={pathname} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar pathname={pathname} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1100px] px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
