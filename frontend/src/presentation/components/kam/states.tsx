import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Card } from "@/presentation/components/ui/card";
import { Skeleton } from "@/presentation/components/ui/skeleton";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-[var(--surface-default)] text-[var(--text-tertiary)]">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div>
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
        ) : null}
      </div>
      {action}
    </Card>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </Card>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Card className="border-[var(--danger)]/30 bg-[var(--danger-muted)] px-6 py-8 text-center">
      <p className="font-[family-name:var(--font-mono)] text-sm text-[var(--danger)]">
        {message}
      </p>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Is the KAM service running? Check <code>KAM_API_BASE_URL</code>.
      </p>
    </Card>
  );
}
