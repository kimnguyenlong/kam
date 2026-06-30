"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

/** Chip-summary multi-select built on the dropdown-menu checkbox items. */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  className,
}: MultiSelectProps) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const selected = options.filter((o) => value.includes(o.value));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex min-h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-inset)] px-3 py-1.5 text-left text-[15px] shadow-[var(--shadow-inset)] transition-colors focus:border-[var(--border-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          className,
        )}
      >
        <span className="flex flex-1 flex-wrap gap-1.5">
          {selected.length === 0 ? (
            <span className="text-[var(--text-tertiary)]">{placeholder}</span>
          ) : (
            selected.map((o) => (
              <Badge key={o.value} tone="neutral">
                {o.label}
              </Badge>
            ))
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 text-[var(--text-tertiary)]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
      >
        {options.length === 0 ? (
          <div className="px-2 py-2 text-sm text-[var(--text-tertiary)]">No options</div>
        ) : (
          options.map((o) => (
            <DropdownMenuCheckboxItem
              key={o.value}
              checked={value.includes(o.value)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => toggle(o.value)}
            >
              {o.label}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
