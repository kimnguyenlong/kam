/**
 * Effect — a grant effect, mirroring the Go `model.Effect` custom JSON
 * (`internal/model/model.go`). On the wire it is exactly the string "allow",
 * the string "deny", or an array of condition ids `["sod","active"]`.
 * Modeled here as a discriminated union; (de)serialization lives in the
 * infrastructure mappers, not here, to keep the domain transport-agnostic.
 */
export type Effect =
  | { readonly kind: "allow" }
  | { readonly kind: "deny" }
  | { readonly kind: "conditional"; readonly conditionIds: string[] };

export const Effect = {
  allow(): Effect {
    return { kind: "allow" };
  },
  deny(): Effect {
    return { kind: "deny" };
  },
  conditional(conditionIds: string[]): Effect {
    return { kind: "conditional", conditionIds };
  },
  /** Condition ids for a conditional effect, else empty. Ports `Effect.CondIDs()`. */
  conditionIds(effect: Effect): string[] {
    return effect.kind === "conditional" ? effect.conditionIds : [];
  },
} as const;
