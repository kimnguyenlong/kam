"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { Condition } from "@/core/domain/entities";
import { conditionHooks, resourceTypeHooks } from "@/presentation/hooks/use-entities";
import { PageHeader } from "@/presentation/components/kam/page-header";
import { DataTable, type Column } from "@/presentation/components/kam/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/presentation/components/kam/states";
import { ConfirmDialog } from "@/presentation/components/kam/confirm-dialog";
import { Field } from "@/presentation/components/kam/field";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Badge } from "@/presentation/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/presentation/components/ui/dialog";

const OPS = ["==", "!=", ">", ">=", "<", "<=", "in", "contains"];
const GENERIC = "__generic__";
const EMPTY: Condition = {
  id: "",
  label: "",
  type: null,
  left: "",
  op: "==",
  rightType: "literal",
  right: "",
};

export default function ConditionsPage() {
  const { data, isLoading, isError } = conditionHooks.useList();
  const resourceTypes = resourceTypeHooks.useList();
  const save = conditionHooks.useSave();
  const remove = conditionHooks.useRemove();

  const [editing, setEditing] = useState<Condition | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleting, setDeleting] = useState<Condition | null>(null);

  const columns: Column<Condition>[] = [
    {
      header: "ID",
      cell: (r) => <span className="font-[family-name:var(--font-mono)] text-[13px]">{r.id}</span>,
    },
    { header: "Label", cell: (r) => r.label },
    {
      header: "Scope",
      cell: (r) => <Badge tone="neutral">{r.type ?? "generic"}</Badge>,
    },
    {
      header: "Rule",
      cell: (r) => (
        <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
          {r.left} {r.op} {r.rightType === "attr" ? r.right : `"${r.right}"`}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="conditions"
        title="Conditions"
        description="ABAC rules evaluated at decision time. A conditional grant AND's its conditions; scope limits which resource.* attributes a rule may reference."
        action={
          <Button
            onClick={() => {
              setEditing({ ...EMPTY });
              setIsNew(true);
            }}
          >
            <Plus className="size-4" /> New condition
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState message="Failed to load conditions." />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState title="No conditions yet" description="Create one or seed prototype data." />
      ) : (
        <DataTable
          columns={columns}
          rows={data ?? []}
          rowKey={(r) => r.id}
          onEdit={(c) => {
            setEditing({ ...c });
            setIsNew(false);
          }}
          onDelete={setDeleting}
        />
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          {editing ? (
            <ConditionForm
              value={editing}
              isNew={isNew}
              pending={save.isPending}
              typeKeys={(resourceTypes.data ?? []).map((t) => t.key)}
              onChange={setEditing}
              onCancel={() => setEditing(null)}
              onSubmit={() => save.mutate(editing, { onSuccess: () => setEditing(null) })}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete condition "${deleting?.id}"?`}
        pending={remove.isPending}
        onConfirm={() =>
          deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </div>
  );
}

function ConditionForm({
  value,
  isNew,
  pending,
  typeKeys,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: Condition;
  isNew: boolean;
  pending: boolean;
  typeKeys: string[];
  onChange: (v: Condition) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const valid = value.id.trim() !== "" && value.left.trim() !== "";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>{isNew ? "New condition" : "Edit condition"}</DialogTitle>
        <DialogDescription>
          Left/right reference attributes like <code>subject.dept</code> or{" "}
          <code>resource.sensitivity</code>; a literal right-hand side is a plain value.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4">
        <Field label="ID">
          <Input
            value={value.id}
            disabled={!isNew}
            onChange={(e) => onChange({ ...value, id: e.target.value })}
            placeholder="active"
            className="font-[family-name:var(--font-mono)] text-[13px]"
          />
        </Field>
        <Field label="Label">
          <Input
            value={value.label}
            onChange={(e) => onChange({ ...value, label: e.target.value })}
            placeholder="Subject is active"
          />
        </Field>
      </div>

      <Field label="Scope" hint="resource type whose attributes this rule may use, or generic">
        <Select
          value={value.type ?? GENERIC}
          onValueChange={(v) => onChange({ ...value, type: v === GENERIC ? null : v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GENERIC}>generic / owner-only</SelectItem>
            {typeKeys.map((k) => (
              <SelectItem key={k} value={k}>
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-[1fr_auto_auto_1fr] items-end gap-3">
        <Field label="Left">
          <Input
            value={value.left}
            onChange={(e) => onChange({ ...value, left: e.target.value })}
            placeholder="subject.status"
            className="font-[family-name:var(--font-mono)] text-[13px]"
          />
        </Field>
        <Field label="Op">
          <Select value={value.op} onValueChange={(op) => onChange({ ...value, op })}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPS.map((op) => (
                <SelectItem key={op} value={op}>
                  {op}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="RHS kind">
          <Select
            value={value.rightType}
            onValueChange={(v: "attr" | "literal") => onChange({ ...value, rightType: v })}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="literal">literal</SelectItem>
              <SelectItem value="attr">attr</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Right">
          <Input
            value={value.right}
            onChange={(e) => onChange({ ...value, right: e.target.value })}
            placeholder={value.rightType === "attr" ? "resource.owner" : "active"}
            className="font-[family-name:var(--font-mono)] text-[13px]"
          />
        </Field>
      </div>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid || pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
