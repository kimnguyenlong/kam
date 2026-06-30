"use client";

import { Plus, X } from "lucide-react";
import type { AttrDecl } from "@/core/domain/entities";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";

/**
 * Editor for a ResourceType's declared ABAC attributes (`AttrDecl[]`). Each row
 * is the key exposed as `resource.<key>` and its default value. Values are
 * edited as text; numeric/boolean-looking strings are coerced on change.
 */
export function AttrDeclEditor({
  value,
  onChange,
}: {
  value: AttrDecl[];
  onChange: (next: AttrDecl[]) => void;
}) {
  const update = (i: number, patch: Partial<AttrDecl>) =>
    onChange(value.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { key: "", value: "" }]);

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 ? (
        <p className="text-xs text-[var(--text-tertiary)]">
          No declared attributes. Items of this type expose no <code>resource.*</code> values.
        </p>
      ) : null}
      {value.map((attr, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            placeholder="key (e.g. sensitivity)"
            value={attr.key}
            onChange={(e) => update(i, { key: e.target.value })}
            className="flex-1 font-[family-name:var(--font-mono)] text-[13px]"
          />
          <Input
            placeholder="default value"
            value={String(attr.value ?? "")}
            onChange={(e) => update(i, { value: coerce(e.target.value) })}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-[var(--text-tertiary)]"
            onClick={() => remove(i)}
            aria-label="Remove attribute"
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={add}>
        <Plus className="size-4" /> Add attribute
      </Button>
    </div>
  );
}

/** Coerce free text to number/boolean when it parses cleanly, else keep the string. */
function coerce(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw.trim() !== "" && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}
