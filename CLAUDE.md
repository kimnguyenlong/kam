# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

"Sentinel — Access Control Manager" is a **single self-contained HTML file** (`access-control.html`) — an in-browser prototype of an RBAC + ABAC access-control engine. There is no build system, no dependencies, no server. Open the file directly in a browser (`open access-control.html`) to run it. All HTML, CSS, and JavaScript live inline in that one file.

## Architecture

The whole app is in the `<script>` block of `access-control.html`. State lives in a single in-memory object `DB` (`{resources, items, conditions, roles, users}`), seeded by `seed()` and persisted to `localStorage` under the key `sentinel_db` via `save()`/`load()` (`migrate()` upgrades older saves). There is no test suite.

### Resource types vs. items

- `DB.resources` are **resource types** (the classes roles get permissions on): `{key, name, domain, actions, attrs}`. A type has **no owner**. `attrs` is `[{key, value}]` — the type **declares** each ABAC attribute (exposed as `resource.<key>`) and the `value` is its **default**.
- `DB.items` are **resource items** — concrete instances of a type: `{id, name, type, owner, attrs}` where `type` is a resource key, `owner` is a user id, and `attrs` is a `{key: value}` map of **per-item overrides** for the attributes the type declares (a missing/blank key inherits the type default; `resolveItemAttr()` does the lookup). Ownership and attribute values live only on items. `itemsByType(key)` / `itemById(id)` look them up.

### The permission model (the part that requires reading multiple functions together)

- **Roles** form an inheritance tree via `parent`. A role's `grants` map keys of the form `"<resourceKey>:<action>"` to an *effect*: `allow`, `deny`, or an ABAC condition id (seeded: `own` / `dept`). Condition labels come from `condLabel()`.
- `roleChain(id)` walks self → ancestors. `effectiveRoleGrants(id)` flattens the chain so **closer roles override more distant ancestors** (it iterates furthest-ancestor-first, overwriting).
- `effectiveUserGrants(userId)` merges grants across all of a user's roles with **deny-wins** precedence.
- `decide(userId, resKey, action, ctx)` is the evaluation engine: resolves roles, finds the matching grant, then applies precedence rules — **no grant = default deny**, **explicit `deny` beats any allow**, otherwise `evalCondition()` checks the ABAC condition against the attribute bag from `buildAttrs()` (subject attrs from the user; `resource.*` resolved per the selected item's `attrs`/`owner`, falling back to the type's declared defaults). It returns `{allow, reason, trace}` where `trace` is the step list rendered in the Playground.

When changing access logic, keep these precedence invariants intact: default-deny, deny-over-allow, and nearer-role-over-ancestor.

### UI structure

Two tabs (`switchView`): **Configuration** (role list, user list, the permission matrix) and **Playground** (simulate a `decide()` call and view the trace + effective permissions).

- The matrix (`renderMatrix`) is per resource **type**, with fixed columns from `ACTIONS_LIB`; cells exist only for actions a type declares. Clicking a cell calls `cyclePerm` which rotates `none → allow → each defined condition → deny`. Inherited cells are read-only. The Playground picks a type **and** an item (the item supplies `resource.owner`).
- Rendering is plain string-templating into `innerHTML`. All user-supplied text must pass through `esc()` to avoid breaking markup.
- `renderAll()` re-renders everything after any mutation; most handlers follow the pattern `mutate DB → save() → renderAll() → toast()`.

## Conventions

- New IDs come from `uid(prefix)`. Resource keys are unique strings like `billing.invoice`; grant keys are `"<key>:<action>"`.
- After mutating `DB`, always call `save()` then the relevant render function(s).
- `.claude/settings.json` disables the Playwright plugin for this project.
