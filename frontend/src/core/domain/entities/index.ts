import type { Effect } from "../value-objects/effect";

/** Fixed action vocabulary the matrix understands — mirrors `model.ActionsLib`. */
export const ACTIONS_LIB = [
  "create",
  "read",
  "update",
  "delete",
  "list",
  "approve",
  "export",
  "share",
  "admin",
] as const;
export type Action = (typeof ACTIONS_LIB)[number];

/** One declared ABAC attribute on a resource type: the `resource.<key>` it exposes and its default. */
export interface AttrDecl {
  key: string;
  value: unknown;
}

/** A class of protected object roles get permissions on. No owner. */
export interface ResourceType {
  key: string;
  name: string;
  domain: string;
  actions: string[];
  attrs: AttrDecl[];
}

/** A concrete instance of a ResourceType. Owner lives here; attrs are per-item overrides. */
export interface Item {
  id: string;
  name: string;
  type: string;
  owner: string;
  attrs: Record<string, unknown>;
}

/** An ABAC rule evaluated at decision time. `type` scopes which resource.* attrs it may reference. */
export interface Condition {
  id: string;
  label: string;
  type: string | null;
  left: string;
  op: string;
  rightType: "attr" | "literal";
  right: string;
}

/** A role in the inheritance tree. `grants` maps `<resourceKey>:<action>` to an Effect. */
export interface Role {
  id: string;
  name: string;
  desc: string;
  parent: string | null;
  grants: Record<string, Effect>;
}

/** A subject. `roles` is the set of assigned role ids. */
export interface User {
  id: string;
  name: string;
  email: string;
  dept: string;
  clearance: number;
  region: string;
  status: string;
  roles: string[];
}

/** One entry in a decision trace (mirrors `engine.Step`). */
export interface DecisionStep {
  kind: "info" | "ok" | "no" | "warn";
  title: string;
  detail: string;
}

/** The result of a check (mirrors `engine.Decision`). */
export interface Decision {
  allow: boolean;
  reason: string;
  trace: DecisionStep[];
}

/** An effective grant with provenance, keyed by `<resourceKey>:<action>` (mirrors `engine.Grant`). */
export interface EffectiveGrant {
  key: string;
  effect: Effect;
  source: string;
  inherited: boolean;
  viaRole: string;
}
