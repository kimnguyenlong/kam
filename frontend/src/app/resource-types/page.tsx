"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ACTIONS_LIB, type ResourceType } from "@/core/domain/entities";
import { resourceTypeHooks } from "@/presentation/hooks/use-entities";
import { PageHeader } from "@/presentation/components/kam/page-header";
import { DataTable, type Column } from "@/presentation/components/kam/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/presentation/components/kam/states";
import { ConfirmDialog } from "@/presentation/components/kam/confirm-dialog";
import { Field } from "@/presentation/components/kam/field";
import { AttrDeclEditor } from "@/presentation/components/kam/attr-decl-editor";
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

const EMPTY: ResourceType = { key: "", name: "", domain: "", actions: [], attrs: [] };

export default function ResourceTypesPage() {
  const { data, isLoading, isError } = resourceTypeHooks.useList();
  const save = resourceTypeHooks.useSave();
  const remove = resourceTypeHooks.useRemove();

  const [editing, setEditing] = useState<ResourceType | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleting, setDeleting] = useState<ResourceType | null>(null);

  const openCreate = () => {
    setEditing({ ...EMPTY });
    setIsNew(true);
  };
  const openEdit = (rt: ResourceType) => {
    setEditing({ ...rt, attrs: rt.attrs.map((a) => ({ ...a })) });
    setIsNew(false);
  };

  const columns: Column<ResourceType>[] = [
    {
      header: "Key",
      cell: (r) => <span className="font-[family-name:var(--font-mono)] text-[13px]">{r.key}</span>,
    },
    { header: "Name", cell: (r) => r.name },
    { header: "Domain", cell: (r) => <Badge tone="neutral">{r.domain}</Badge> },
    {
      header: "Actions",
      cell: (r) => (
        <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
          {r.actions.join(" · ")}
        </span>
      ),
    },
    {
      header: "Attrs",
      cell: (r) => (
        <span className="text-xs text-[var(--text-tertiary)]">{r.attrs.length}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="resource types"
        title="Resource Types"
        description="Classes of protected object roles get permissions on. No owner — attributes declare ABAC defaults that items may override."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> New type
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState message="Failed to load resource types." />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No resource types yet"
          description="Create one, or seed the prototype data from the overview."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" /> New type
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={data ?? []}
          rowKey={(r) => r.key}
          onEdit={openEdit}
          onDelete={setDeleting}
        />
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          {editing ? (
            <FormBody
              value={editing}
              isNew={isNew}
              pending={save.isPending}
              onChange={setEditing}
              onCancel={() => setEditing(null)}
              onSubmit={() =>
                save.mutate(editing, { onSuccess: () => setEditing(null) })
              }
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.key}"?`}
        description="This removes the resource type and re-syncs Keto tuples. Items of this type are not deleted."
        pending={remove.isPending}
        onConfirm={() =>
          deleting && remove.mutate(deleting.key, { onSuccess: () => setDeleting(null) })
        }
      />
    </div>
  );
}

function FormBody({
  value,
  isNew,
  pending,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: ResourceType;
  isNew: boolean;
  pending: boolean;
  onChange: (v: ResourceType) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const valid = value.key.trim() !== "" && value.name.trim() !== "";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>{isNew ? "New resource type" : "Edit resource type"}</DialogTitle>
        <DialogDescription>
          The key is the identifier used in grants (e.g. <code>billing.invoice</code>).
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Key" hint="immutable identifier; dots allowed">
          <Input
            value={value.key}
            disabled={!isNew}
            onChange={(e) => onChange({ ...value, key: e.target.value })}
            placeholder="billing.invoice"
            className="font-[family-name:var(--font-mono)] text-[13px]"
          />
        </Field>
        <Field label="Domain">
          <Input
            value={value.domain}
            onChange={(e) => onChange({ ...value, domain: e.target.value })}
            placeholder="billing"
          />
        </Field>
      </div>

      <Field label="Name">
        <Input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Invoice"
        />
      </Field>

      <Field label="Actions" hint="the operations this type supports">
        <MultiSelect
          options={ACTIONS_LIB.map((a) => ({ value: a, label: a }))}
          value={value.actions}
          onChange={(actions) => onChange({ ...value, actions })}
          placeholder="Select actions…"
        />
      </Field>

      <Field label="Declared attributes" hint="resource.<key> defaults; items may override">
        <AttrDeclEditor value={value.attrs} onChange={(attrs) => onChange({ ...value, attrs })} />
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
