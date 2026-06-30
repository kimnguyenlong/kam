import type { Role } from "@/core/domain/entities";
import { effectFromWire, effectToWire, type WireEffect } from "./effect-mapper";

/** Wire shape of a Role (grants carry the wire effect encoding). */
export interface WireRole {
  id: string;
  name: string;
  desc: string;
  parent: string | null;
  grants: Record<string, WireEffect> | null;
}

export function roleFromWire(w: WireRole): Role {
  const grants: Role["grants"] = {};
  for (const [key, wire] of Object.entries(w.grants ?? {})) {
    grants[key] = effectFromWire(wire);
  }
  return {
    id: w.id,
    name: w.name,
    desc: w.desc,
    parent: w.parent ?? null,
    grants,
  };
}

export function roleToWire(r: Role): WireRole {
  const grants: Record<string, WireEffect> = {};
  for (const [key, effect] of Object.entries(r.grants)) {
    grants[key] = effectToWire(effect);
  }
  return {
    id: r.id,
    name: r.name,
    desc: r.desc,
    parent: r.parent,
    grants,
  };
}
