"use client";

import type { Condition, ResourceType } from "@/core/domain/entities";
import { Effect } from "@/core/domain/value-objects/effect";
import { GrantKey } from "@/core/domain/value-objects/grant-key";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { MultiSelect } from "@/presentation/components/ui/multi-select";
import { Badge } from "@/presentation/components/ui/badge";

type EffectKind = "none" | "allow" | "deny" | "conditional";

function kindOf(effect: Effect | undefined): EffectKind {
  if (!effect) return "none";
  return effect.kind;
}

/**
 * Edits a Role's `grants` map (`<resourceKey>:<action>` -> Effect). One block per
 * resource type; each action row picks none/allow/deny/conditional. Conditional
 * reveals a multi-select of condition ids (AND'd by the engine at decision time).
 */
export function GrantMatrixEditor({
  resourceTypes,
  conditions,
  value,
  onChange,
}: {
  resourceTypes: ResourceType[];
  conditions: Condition[];
  value: Record<string, Effect>;
  onChange: (next: Record<string, Effect>) => void;
}) {
  const setEffect = (key: string, effect: Effect | null) => {
    const next = { ...value };
    if (effect === null) delete next[key];
    else next[key] = effect;
    onChange(next);
  };

  if (resourceTypes.length === 0) {
    return (
      <p className="text-sm text-[var(--text-tertiary)]">
        No resource types defined yet — create some first to author grants.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {resourceTypes.map((rt) => (
        <div
          key={rt.key}
          className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-base)]"
        >
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-2.5">
            <span className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--text-primary)]">
              {rt.key}
            </span>
            <Badge tone="neutral">{rt.domain}</Badge>
          </div>
          <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {rt.actions.map((action) => {
              const key = GrantKey.make(rt.key, action);
              const effect = value[key];
              const kind = kindOf(effect);
              return (
                <div key={action} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-24 shrink-0 font-[family-name:var(--font-mono)] text-[13px] text-[var(--text-secondary)]">
                    {action}
                  </span>
                  <Select
                    value={kind}
                    onValueChange={(v: EffectKind) => {
                      if (v === "none") setEffect(key, null);
                      else if (v === "allow") setEffect(key, Effect.allow());
                      else if (v === "deny") setEffect(key, Effect.deny());
                      else setEffect(key, Effect.conditional(Effect.conditionIds(effect ?? Effect.conditional([]))));
                    }}
                  >
                    <SelectTrigger className="h-9 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— none —</SelectItem>
                      <SelectItem value="allow">allow</SelectItem>
                      <SelectItem value="deny">deny</SelectItem>
                      <SelectItem value="conditional">conditional</SelectItem>
                    </SelectContent>
                  </Select>
                  {kind === "conditional" ? (
                    <MultiSelect
                      className="flex-1"
                      placeholder="condition ids…"
                      options={conditions.map((c) => ({ value: c.id, label: c.label || c.id }))}
                      value={Effect.conditionIds(effect ?? Effect.conditional([]))}
                      onChange={(ids) => setEffect(key, Effect.conditional(ids))}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
