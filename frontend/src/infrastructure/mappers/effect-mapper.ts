import { Effect } from "@/core/domain/value-objects/effect";

/** Wire shape of a grant effect: "allow" | "deny" | string[] (condition ids). */
export type WireEffect = string | string[];

/** Decode a wire effect to the domain union. Accepts a legacy single condition-id string. */
export function effectFromWire(wire: WireEffect): Effect {
  if (Array.isArray(wire)) return Effect.conditional(wire);
  if (wire === "allow") return Effect.allow();
  if (wire === "deny") return Effect.deny();
  // Legacy single condition id.
  return Effect.conditional([wire]);
}

/** Encode a domain effect to its exact wire shape. */
export function effectToWire(effect: Effect): WireEffect {
  switch (effect.kind) {
    case "allow":
      return "allow";
    case "deny":
      return "deny";
    case "conditional":
      return effect.conditionIds;
  }
}
