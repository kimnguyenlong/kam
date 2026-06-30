"use client";

import Link from "next/link";
import { Boxes, Database, FileStack, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { PageHeader } from "@/presentation/components/kam/page-header";
import {
  conditionHooks,
  itemHooks,
  resourceTypeHooks,
  roleHooks,
  userHooks,
} from "@/presentation/hooks/use-entities";
import { useSeed } from "@/presentation/hooks/use-decisions";
import { Button } from "@/presentation/components/ui/button";
import { Card, CardContent } from "@/presentation/components/ui/card";

const TILES = [
  { href: "/resource-types", label: "Resource Types", icon: Boxes, useList: resourceTypeHooks.useList },
  { href: "/items", label: "Items", icon: FileStack, useList: itemHooks.useList },
  { href: "/conditions", label: "Conditions", icon: SlidersHorizontal, useList: conditionHooks.useList },
  { href: "/roles", label: "Roles", icon: ShieldCheck, useList: roleHooks.useList },
  { href: "/users", label: "Users", icon: Users, useList: userHooks.useList },
] as const;

function CountTile({
  href,
  label,
  icon: Icon,
  useList,
}: {
  href: string;
  label: string;
  icon: typeof Boxes;
  useList: () => { data?: unknown[]; isLoading: boolean; isError: boolean };
}) {
  const { data, isLoading, isError } = useList();
  const count = data?.length ?? 0;
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-[var(--shadow-lg),var(--ring-hairline)]">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="kl-eyebrow">// {label}</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-[40px] font-semibold leading-none tracking-[-0.02em] text-[var(--text-primary)]">
              {isLoading ? "—" : isError ? "!" : count}
            </p>
          </div>
          <div className="flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-muted)] text-[var(--tan-500)]">
            <Icon className="size-5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const seed = useSeed();
  return (
    <div>
      <PageHeader
        eyebrow="overview"
        title="Access Control Manager"
        description="RBAC reachability resolved by Ory Keto, ABAC conditions overlaid by the Go engine. Configure the model here, then exercise decisions in the Playground."
        action={
          <Button onClick={() => seed.mutate()} disabled={seed.isPending}>
            <Database className="size-4" />
            {seed.isPending ? "Seeding…" : "Seed prototype data"}
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {TILES.map((t) => (
          <CountTile key={t.href} {...t} />
        ))}
      </div>
    </div>
  );
}
