import type { Effect } from "@/core/domain/value-objects/effect";
import { Badge } from "@/presentation/components/ui/badge";

/** Renders a grant Effect as a toned badge: allow=success, deny=danger, conditional=warning. */
export function EffectBadge({ effect }: { effect: Effect }) {
  if (effect.kind === "allow") return <Badge tone="success">allow</Badge>;
  if (effect.kind === "deny") return <Badge tone="danger">deny</Badge>;
  return (
    <Badge tone="warning" title={effect.conditionIds.join(", ")}>
      {effect.conditionIds.length === 1
        ? effect.conditionIds[0]
        : `${effect.conditionIds.length} conds`}
    </Badge>
  );
}
