"use client";

import type { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card } from "@/presentation/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/presentation/components/ui/table";
import { Button } from "@/presentation/components/ui/button";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}

export function DataTable<T>({ columns, rows, rowKey, onEdit, onDelete }: DataTableProps<T>) {
  const hasActions = Boolean(onEdit || onDelete);
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead key={c.header} className={c.className}>
                {c.header}
              </TableHead>
            ))}
            {hasActions ? <TableHead className="w-24 text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((c) => (
                <TableCell key={c.header} className={c.className}>
                  {c.cell(row)}
                </TableCell>
              ))}
              {hasActions ? (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {onEdit ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => onEdit(row)}
                        aria-label="Edit"
                      >
                        <Pencil className="size-4" />
                      </Button>
                    ) : null}
                    {onDelete ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-[var(--danger)] hover:bg-[var(--danger-muted)]"
                        onClick={() => onDelete(row)}
                        aria-label="Delete"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
