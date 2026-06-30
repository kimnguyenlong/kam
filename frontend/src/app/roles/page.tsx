"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { Role } from "@/core/domain/entities";
import {
  conditionHooks,
  resourceTypeHooks,
  roleHooks,
} from "@/presentation/hooks/use-entities";
import { PageHeader } from "@/presentation/components/kam/page-header";
import { DataTable, type Column } from "@/presentation/components/kam/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/presentation/components/kam/states";
import { ConfirmDialog } from "@/presentation/components/kam/confirm-dialog";
import { Field } from "@/presentation/components/kam/field";
import { GrantMatrixEditor } from "@/presentation/components/kam/grant-matrix-editor";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Textarea } from "@/presentation/components/ui/textarea";
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

const NO_PARENT = "__none__";
const EMPTY: Role = { id: "", name: "", desc: "", parent: null, grants: {} };

export default function RolesPage() {
  const { data, isLoading, isError } = roleHooks.useList();
  const resourceTypes = resourceTypeHooks.useList();
  const conditions = conditionHooks.useList();
  const save = roleHooks.useSave();
  const remove = roleHooks.useRemove();

  const [editing, setEditing] = useState<Role | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleting, setDeleting] = useState<Role | null>(null);

  const columns: Column<Role>[] = [
    {
      header: "ID",
      cell: (r) => <span className="font-[family-name:var(--font-mono)] text-[13px]">{r.id}</span>,
    },
    { header: "Name", cell: (r) => r.name },
    {
      header: "Parent",
      cell: (r) => (r.parent ? <Badge tone="accent">{r.parent}</Badge> : <span className="text-[var(--text-tertiary)]">—</span>),
    },
    {
      header: "Grants",
      cell: (r) => (
        <span className="text-xs text-[var(--text-tertiary)]">
          {Object.keys(r.grants ?? {}).length}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="roles"
        title="Roles"
        description="Roles inherit via parent and grant allow/deny/conditional permissions per resource action. Keto resolves reachability; deny beats allow, nearer roles beat ancestors."
        action={
          <Button
            onClick={() => {
              setEditing({ ...EMPTY });
              setIsNew(true);
            }}
          >
            <Plus className="size-4" /> New role
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState message="Failed to load roles." />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState title="No roles yet" description="Create one or seed prototype data." />
      ) : (
        <DataTable
          columns={columns}
          rows={data ?? []}
          rowKey={(r) => r.id}
          onEdit={(role) => {
            setEditing({ ...role, grants: { ...role.grants } });
            setIsNew(false);
          }}
          onDelete={setDeleting}
        />
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl">
          {editing ? (
            <RoleForm
              value={editing}
              isNew={isNew}
              pending={save.isPending}
              roles={(data ?? []).filter((r) => r.id !== editing.id)}
              resourceTypes={resourceTypes.data ?? []}
              conditions={conditions.data ?? []}
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
        title={`Delete role "${deleting?.id}"?`}
        description="Roles inheriting from or users assigned this role will lose the grant chain on next sync."
        pending={remove.isPending}
        onConfirm={() =>
          deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </div>
  );
}

function RoleForm({
  value,
  isNew,
  pending,
  roles,
  resourceTypes,
  conditions,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: Role;
  isNew: boolean;
  pending: boolean;
  roles: Role[];
  resourceTypes: import("@/core/domain/entities").ResourceType[];
  conditions: import("@/core/domain/entities").Condition[];
  onChange: (v: Role) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const valid = value.id.trim() !== "" && value.name.trim() !== "";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>{isNew ? "New role" : "Edit role"}</DialogTitle>
        <DialogDescription>
          Conditional grants AND their condition ids; an explicit deny always wins.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4">
        <Field label="ID">
          <Input
            value={value.id}
            disabled={!isNew}
            onChange={(e) => onChange({ ...value, id: e.target.value })}
            placeholder="billing-approver"
            className="font-[family-name:var(--font-mono)] text-[13px]"
          />
        </Field>
        <Field label="Name">
          <Input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="Billing Approver"
          />
        </Field>
      </div>

      <Field label="Parent" hint="role this one inherits grants from">
        <Select
          value={value.parent ?? NO_PARENT}
          onValueChange={(v) => onChange({ ...value, parent: v === NO_PARENT ? null : v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PARENT}>— none —</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Description">
        <Textarea
          value={value.desc}
          onChange={(e) => onChange({ ...value, desc: e.target.value })}
          placeholder="What this role is for…"
        />
      </Field>

      <Field label="Grants">
        <GrantMatrixEditor
          resourceTypes={resourceTypes}
          conditions={conditions}
          value={value.grants}
          onChange={(grants) => onChange({ ...value, grants })}
        />
      </Field>

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
