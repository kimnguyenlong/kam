"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { User } from "@/core/domain/entities";
import { roleHooks, userHooks } from "@/presentation/hooks/use-entities";
import { PageHeader } from "@/presentation/components/kam/page-header";
import { DataTable, type Column } from "@/presentation/components/kam/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/presentation/components/kam/states";
import { ConfirmDialog } from "@/presentation/components/kam/confirm-dialog";
import { Field } from "@/presentation/components/kam/field";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Badge } from "@/presentation/components/ui/badge";
import { MultiSelect } from "@/presentation/components/ui/multi-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/presentation/components/ui/dialog";

const EMPTY: User = {
  id: "",
  name: "",
  email: "",
  dept: "",
  clearance: 0,
  region: "",
  status: "active",
  roles: [],
};

export default function UsersPage() {
  const { data, isLoading, isError } = userHooks.useList();
  const roles = roleHooks.useList();
  const save = userHooks.useSave();
  const remove = userHooks.useRemove();

  const [editing, setEditing] = useState<User | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);

  const columns: Column<User>[] = [
    {
      header: "ID",
      cell: (r) => <span className="font-[family-name:var(--font-mono)] text-[13px]">{r.id}</span>,
    },
    { header: "Name", cell: (r) => r.name },
    { header: "Dept", cell: (r) => r.dept || "—" },
    {
      header: "Status",
      cell: (r) => (
        <Badge tone={r.status === "active" ? "success" : "neutral"}>{r.status || "—"}</Badge>
      ),
    },
    {
      header: "Roles",
      cell: (r) => (
        <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
          {r.roles.length ? r.roles.join(" · ") : "—"}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="users"
        title="Users"
        description="Subjects. The service does no authentication — a user id is simply the already-authenticated subject passed to a decision. Attributes feed ABAC conditions."
        action={
          <Button
            onClick={() => {
              setEditing({ ...EMPTY });
              setIsNew(true);
            }}
          >
            <Plus className="size-4" /> New user
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState message="Failed to load users." />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState title="No users yet" description="Create one or seed prototype data." />
      ) : (
        <DataTable
          columns={columns}
          rows={data ?? []}
          rowKey={(r) => r.id}
          onEdit={(u) => {
            setEditing({ ...u, roles: [...u.roles] });
            setIsNew(false);
          }}
          onDelete={setDeleting}
        />
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          {editing ? (
            <UserForm
              value={editing}
              isNew={isNew}
              pending={save.isPending}
              roleIds={(roles.data ?? []).map((r) => r.id)}
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
        title={`Delete user "${deleting?.id}"?`}
        pending={remove.isPending}
        onConfirm={() =>
          deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </div>
  );
}

function UserForm({
  value,
  isNew,
  pending,
  roleIds,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: User;
  isNew: boolean;
  pending: boolean;
  roleIds: string[];
  onChange: (v: User) => void;
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
        <DialogTitle>{isNew ? "New user" : "Edit user"}</DialogTitle>
        <DialogDescription>
          Subject attributes are exposed to conditions as <code>subject.dept</code>,{" "}
          <code>subject.clearance</code>, etc.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4">
        <Field label="ID">
          <Input
            value={value.id}
            disabled={!isNew}
            onChange={(e) => onChange({ ...value, id: e.target.value })}
            placeholder="u-alice"
            className="font-[family-name:var(--font-mono)] text-[13px]"
          />
        </Field>
        <Field label="Name">
          <Input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="Alice Stone"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Email">
          <Input
            type="email"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            placeholder="alice@example.com"
          />
        </Field>
        <Field label="Department">
          <Input
            value={value.dept}
            onChange={(e) => onChange({ ...value, dept: e.target.value })}
            placeholder="finance"
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Clearance">
          <Input
            type="number"
            value={String(value.clearance)}
            onChange={(e) => onChange({ ...value, clearance: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Region">
          <Input
            value={value.region}
            onChange={(e) => onChange({ ...value, region: e.target.value })}
            placeholder="us"
          />
        </Field>
        <Field label="Status">
          <Input
            value={value.status}
            onChange={(e) => onChange({ ...value, status: e.target.value })}
            placeholder="active"
          />
        </Field>
      </div>

      <Field label="Roles">
        <MultiSelect
          options={roleIds.map((id) => ({ value: id, label: id }))}
          value={value.roles}
          onChange={(rolesSel) => onChange({ ...value, roles: rolesSel })}
          placeholder="Assign roles…"
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
