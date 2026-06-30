"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { Item } from "@/core/domain/entities";
import { itemHooks, resourceTypeHooks, userHooks } from "@/presentation/hooks/use-entities";
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

const EMPTY: Item = { id: "", name: "", type: "", owner: "", attrs: {} };

export default function ItemsPage() {
  const { data, isLoading, isError } = itemHooks.useList();
  const resourceTypes = resourceTypeHooks.useList();
  const users = userHooks.useList();
  const save = itemHooks.useSave();
  const remove = itemHooks.useRemove();

  const [editing, setEditing] = useState<Item | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleting, setDeleting] = useState<Item | null>(null);

  const columns: Column<Item>[] = [
    {
      header: "ID",
      cell: (r) => <span className="font-[family-name:var(--font-mono)] text-[13px]">{r.id}</span>,
    },
    { header: "Name", cell: (r) => r.name },
    { header: "Type", cell: (r) => <Badge tone="neutral">{r.type}</Badge> },
    {
      header: "Owner",
      cell: (r) => (
        <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
          {r.owner || "—"}
        </span>
      ),
    },
    {
      header: "Overrides",
      cell: (r) => (
        <span className="text-xs text-[var(--text-tertiary)]">
          {Object.keys(r.attrs ?? {}).length}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="items"
        title="Items"
        description="Concrete instances of a resource type. The owner lives here; per-item attributes override the type's declared defaults."
        action={
          <Button
            onClick={() => {
              setEditing({ ...EMPTY });
              setIsNew(true);
            }}
          >
            <Plus className="size-4" /> New item
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState message="Failed to load items." />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState title="No items yet" description="Create one or seed prototype data." />
      ) : (
        <DataTable
          columns={columns}
          rows={data ?? []}
          rowKey={(r) => r.id}
          onEdit={(item) => {
            setEditing({ ...item, attrs: { ...item.attrs } });
            setIsNew(false);
          }}
          onDelete={setDeleting}
        />
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          {editing ? (
            <ItemForm
              value={editing}
              isNew={isNew}
              pending={save.isPending}
              resourceTypes={resourceTypes.data ?? []}
              userIds={(users.data ?? []).map((u) => u.id)}
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
        title={`Delete item "${deleting?.id}"?`}
        pending={remove.isPending}
        onConfirm={() =>
          deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </div>
  );
}

function ItemForm({
  value,
  isNew,
  pending,
  resourceTypes,
  userIds,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: Item;
  isNew: boolean;
  pending: boolean;
  resourceTypes: { key: string; name: string; attrs: { key: string; value: unknown }[] }[];
  userIds: string[];
  onChange: (v: Item) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const selectedType = useMemo(
    () => resourceTypes.find((t) => t.key === value.type),
    [resourceTypes, value.type],
  );
  const valid = value.id.trim() !== "" && value.type.trim() !== "";

  const setAttr = (key: string, raw: string) => {
    const attrs = { ...value.attrs };
    if (raw === "") delete attrs[key];
    else attrs[key] = raw;
    onChange({ ...value, attrs });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>{isNew ? "New item" : "Edit item"}</DialogTitle>
        <DialogDescription>
          Override values map to <code>resource.&lt;key&gt;</code>; leave blank to inherit the type
          default (shown as placeholder).
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4">
        <Field label="ID">
          <Input
            value={value.id}
            disabled={!isNew}
            onChange={(e) => onChange({ ...value, id: e.target.value })}
            placeholder="inv-1001"
            className="font-[family-name:var(--font-mono)] text-[13px]"
          />
        </Field>
        <Field label="Name">
          <Input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="March invoice"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Type">
          <Select value={value.type} onValueChange={(type) => onChange({ ...value, type })}>
            <SelectTrigger>
              <SelectValue placeholder="Select type…" />
            </SelectTrigger>
            <SelectContent>
              {resourceTypes.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Owner" hint="user id of the owner">
          <Select
            value={value.owner || undefined}
            onValueChange={(owner) => onChange({ ...value, owner })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select owner…" />
            </SelectTrigger>
            <SelectContent>
              {userIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {selectedType && selectedType.attrs.length > 0 ? (
        <Field label="Attribute overrides">
          <div className="flex flex-col gap-2">
            {selectedType.attrs.map((decl) => (
              <div key={decl.key} className="flex items-center gap-3">
                <span className="w-40 shrink-0 font-[family-name:var(--font-mono)] text-[13px] text-[var(--text-secondary)]">
                  resource.{decl.key}
                </span>
                <Input
                  value={value.attrs[decl.key] !== undefined ? String(value.attrs[decl.key]) : ""}
                  placeholder={`default: ${String(decl.value ?? "")}`}
                  onChange={(e) => setAttr(decl.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </Field>
      ) : selectedType ? (
        <p className="text-xs text-[var(--text-tertiary)]">
          This type declares no attributes to override.
        </p>
      ) : null}

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
