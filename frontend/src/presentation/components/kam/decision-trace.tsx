import { Ban, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { Decision, DecisionStep } from "@/core/domain/entities";
import { cn } from "@/lib/utils";
import { Card } from "@/presentation/components/ui/card";

const STEP_STYLE: Record<DecisionStep["kind"], { icon: typeof Info; color: string }> = {
  ok: { icon: CircleCheck, color: "var(--success)" },
  no: { icon: Ban, color: "var(--danger)" },
  warn: { icon: TriangleAlert, color: "var(--warning)" },
  info: { icon: Info, color: "var(--text-tertiary)" },
};

/** Renders an engine Decision: verdict banner + the step-by-step trace timeline. */
export function DecisionTrace({ decision }: { decision: Decision }) {
  return (
    <div className="flex flex-col gap-4">
      <Card
        className={cn(
          "flex items-center gap-3 px-5 py-4",
          decision.allow
            ? "border-[var(--success)]/30 bg-[var(--success-muted)]"
            : "border-[var(--danger)]/30 bg-[var(--danger-muted)]",
        )}
      >
        {decision.allow ? (
          <CircleCheck className="size-6 text-[var(--success)]" />
        ) : (
          <Ban className="size-6 text-[var(--danger)]" />
        )}
        <div>
          <p
            className="font-[family-name:var(--font-display)] text-xl font-semibold"
            style={{ color: decision.allow ? "var(--success)" : "var(--danger)" }}
          >
            {decision.allow ? "Allowed" : "Denied"}
          </p>
          <p className="text-sm text-[var(--text-secondary)]">{decision.reason}</p>
        </div>
      </Card>

      <Card className="p-0">
        <div className="border-b border-[var(--border-subtle)] px-5 py-3">
          <p className="kl-eyebrow">// decision trace</p>
        </div>
        <ol className="flex flex-col">
          {decision.trace.map((step, i) => {
            const { icon: Icon, color } = STEP_STYLE[step.kind] ?? STEP_STYLE.info;
            return (
              <li
                key={i}
                className="flex gap-3 border-b border-[var(--border-subtle)] px-5 py-3 last:border-0"
              >
                <Icon className="mt-0.5 size-[18px] shrink-0" style={{ color }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{step.title}</p>
                  {step.detail ? (
                    <p className="mt-0.5 font-[family-name:var(--font-mono)] text-xs text-[var(--text-secondary)]">
                      {step.detail}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
