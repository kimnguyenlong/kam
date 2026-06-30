"use client";

import { useState } from "react";
import { Activity } from "lucide-react";
import { userHooks } from "@/presentation/hooks/use-entities";
import { useExpandUser } from "@/presentation/hooks/use-decisions";
import { PageHeader } from "@/presentation/components/kam/page-header";
import { Field } from "@/presentation/components/kam/field";
import { EmptyState } from "@/presentation/components/kam/states";
import { EffectBadge } from "@/presentation/components/kam/effect-badge";
import { Card } from "@/presentation/components/ui/card";
import { Button } from "@/presentation/components/ui/button";
import { Badge } from "@/presentation/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/presentation/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";

export default function ExpandPage() {
  const users = userHooks.useList();
  const expand = useExpandUser();
  const [userId, setUserId] = useState("");

  return (
    <div>
      <PageHeader
        eyebrow="expand"
        title="Effective Grants"
        description="Flatten a user's effective grants across their role chain, with provenance: which role authored each grant, whether it was inherited, and via which assigned role."
      />

      <Card className="mb-6 p-5">
        <div className="flex items-end gap-3">
          <Field label="Subject (user)">
            <div className="w-80">
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user…" />
                </SelectTrigger>
                <SelectContent>
                  {(users.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.id} — {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Field>
          <Button onClick={() => userId && expand.mutate(userId)} disabled={!userId || expand.isPending}>
            <Activity className="size-4" />
            {expand.isPending ? "Expanding…" : "Expand"}
          </Button>
        </div>
      </Card>

      {expand.isError ? (
        <Card className="border-[var(--danger)]/30 bg-[var(--danger-muted)] px-5 py-4">
          <p className="font-[family-name:var(--font-mono)] text-sm text-[var(--danger)]">
            {(expand.error as Error).message}
          </p>
        </Card>
      ) : expand.data ? (
        expand.data.length === 0 ? (
          <EmptyState title="No effective grants" description="This user reaches no grants." />
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Grant key</TableHead>
                  <TableHead>Effect</TableHead>
                  <TableHead>Source role</TableHead>
                  <TableHead>Inherited</TableHead>
                  <TableHead>Via role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expand.data.map((g) => (
                  <TableRow key={g.key}>
                    <TableCell className="font-[family-name:var(--font-mono)] text-[13px]">
                      {g.key}
                    </TableCell>
                    <TableCell>
                      <EffectBadge effect={g.effect} />
                    </TableCell>
                    <TableCell className="font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
                      {g.source}
                    </TableCell>
                    <TableCell>
                      {g.inherited ? (
                        <Badge tone="info">inherited</Badge>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">direct</span>
                      )}
                    </TableCell>
                    <TableCell className="font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
                      {g.viaRole}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )
      ) : (
        <EmptyState
          icon={<Activity className="size-5" />}
          title="No expansion yet"
          description="Pick a user and expand to see their effective grants."
        />
      )}
    </div>
  );
}
