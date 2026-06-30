"use client";

import { useMemo, useState } from "react";
import { Play } from "lucide-react";
import {
  itemHooks,
  resourceTypeHooks,
  userHooks,
} from "@/presentation/hooks/use-entities";
import { useCheckAccess } from "@/presentation/hooks/use-decisions";
import { PageHeader } from "@/presentation/components/kam/page-header";
import { Field } from "@/presentation/components/kam/field";
import { DecisionTrace } from "@/presentation/components/kam/decision-trace";
import { EmptyState } from "@/presentation/components/kam/states";
import { Card } from "@/presentation/components/ui/card";
import { Button } from "@/presentation/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";

const ANY_ITEM = "__any__";

export default function PlaygroundPage() {
  const users = userHooks.useList();
  const resourceTypes = resourceTypeHooks.useList();
  const items = itemHooks.useList();
  const check = useCheckAccess();

  const [userId, setUserId] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [action, setAction] = useState("");
  const [itemId, setItemId] = useState(ANY_ITEM);

  const selectedType = useMemo(
    () => (resourceTypes.data ?? []).find((t) => t.key === resourceType),
    [resourceTypes.data, resourceType],
  );
  const typeItems = useMemo(
    () => (items.data ?? []).filter((i) => i.type === resourceType),
    [items.data, resourceType],
  );

  const canRun = userId && resourceType && action;

  const run = () => {
    if (!canRun) return;
    check.mutate({
      userId,
      resourceType,
      action,
      itemId: itemId === ANY_ITEM ? "" : itemId,
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow="playground"
        title="Access Playground"
        description="Ask the engine a question. Keto answers base reachability; the Go overlay applies ABAC conditions and precedence, returning the verdict and a full trace."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit p-5">
          <div className="flex flex-col gap-4">
            <Field label="Subject (user)">
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
            </Field>

            <Field label="Resource type">
              <Select
                value={resourceType}
                onValueChange={(v) => {
                  setResourceType(v);
                  setAction("");
                  setItemId(ANY_ITEM);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type…" />
                </SelectTrigger>
                <SelectContent>
                  {(resourceTypes.data ?? []).map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Action">
              <Select value={action} onValueChange={setAction} disabled={!selectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action…" />
                </SelectTrigger>
                <SelectContent>
                  {(selectedType?.actions ?? []).map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Item" hint="optional — drives resource.* attribute overrides">
              <Select value={itemId} onValueChange={setItemId} disabled={!selectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_ITEM}>— none / type defaults —</SelectItem>
                  {typeItems.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.id} — {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Button onClick={run} disabled={!canRun || check.isPending}>
              <Play className="size-4" />
              {check.isPending ? "Evaluating…" : "Evaluate access"}
            </Button>
          </div>
        </Card>

        <div>
          {check.isError ? (
            <Card className="border-[var(--danger)]/30 bg-[var(--danger-muted)] px-5 py-4">
              <p className="font-[family-name:var(--font-mono)] text-sm text-[var(--danger)]">
                {(check.error as Error).message}
              </p>
            </Card>
          ) : check.data ? (
            <DecisionTrace decision={check.data} />
          ) : (
            <EmptyState
              icon={<Play className="size-5" />}
              title="No decision yet"
              description="Pick a subject, resource type and action, then evaluate."
            />
          )}
        </div>
      </div>
    </div>
  );
}
