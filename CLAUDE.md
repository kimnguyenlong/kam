# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

KAM is a Go backend port of the `access-control.html` prototype — an **RBAC + ABAC** access-control
service. The HTML file is kept in the repo as the **reference prototype**; the Go engine faithfully ports
its `decide()` and is meant to stay behavior-compatible with it. Module: `github.com/kimnguyenlong/kam`.

The service performs **no authentication** — callers pass an already-authenticated subject id.

The repo also ships an admin UI in `frontend/` (Next.js 16, clean architecture) that drives the Go service
through a server-side proxy. See [Frontend](#frontend-frontend) below.

## Commands

```bash
go build ./cmd/server            # build the service (binary also committed as ./basic — gitignored is /kam)
go test ./...                    # run tests
go test ./internal/engine/ -run TestDecide -v   # the decision-engine tests (the only test package)
go vet ./...

docker compose up --build        # postgres + keto (migrated, OPL loaded) + kam :8080 + frontend :3000
curl -XPOST localhost:8080/v1/seed   # load prototype seed data and sync Keto tuples
```

Copy `.env.example` to `.env` before `docker compose up` — it interpolates Postgres/Keto/`KAM_*` values
into `docker-compose.yml`. The Go binary does **not** auto-load `.env`; for host-only runs export the vars
(or point `KAM_KETO_*` / `KAM_DATABASE_URL` at `localhost`). The frontend reads its own `frontend/.env`
(`KAM_API_BASE_URL`); see `frontend/.env.example`.

Frontend dev (from `frontend/`):

```bash
npm run dev        # Next dev server on :3000 (proxies to KAM_API_BASE_URL, default http://localhost:8080)
npm run build      # production build
npm run lint       # eslint . (NOT `next lint` — removed in Next 16)
npm run typecheck  # tsc --noEmit
```

The **engine tests run fully offline** — they back the engine with an in-memory `fakeStore` and `fakeKeto`
(see `internal/engine/engine_test.go`), so no Postgres or Keto is needed. Anything touching `internal/store`
or `internal/keto` needs the `docker compose` stack (Postgres on :5432, Keto read :4466 / write :4467).

## Architecture

This is a **hybrid engine** and that split is the single most important thing to understand — it is spread
across `internal/keto`, `internal/engine`, and `keto/opl/permissions.ts`:

- **Ory Keto + OPL own the RBAC layer.** Keto is a Zanzibar/ReBAC engine; it resolves relationships
  (role membership, role inheritance, role→action grants) but **cannot** express attribute comparisons or
  deny-over-allow. The OPL model in `keto/opl/permissions.ts` declares one `<action>` relation and one
  `deny_<action>` relation per action in `ActionsLib`. `Check`/`CheckDeny` answer base reachability.
- **The Go engine overlays ABAC + precedence** (`internal/engine/engine.go`, `Decide`). It computes
  effective grants from the Postgres snapshot for **trace provenance and which ABAC conditions to evaluate**,
  but the **authoritative allow/deny reachability comes from Keto** (which resolves the inheritance tree).
- **Postgres (GORM) is the system of record.** Every config mutation re-runs `keto.SyncAll`, which clears
  the `Role` and `Resource` namespaces and rewrites all tuples from the current snapshot. Keto holds no
  durable truth of its own — it is a derived index.

Tuple shapes written by `SyncAll` (must match the OPL namespaces/relations):
- membership: `Role:<id>#members@User:<uid>`
- inheritance (nested groups): `Role:<parent>#members@(Role:<child>#members)`
- allow/conditional grant: `Resource:<key>#<action>@(Role:<rid>#members)`
- deny grant: `Resource:<key>#deny_<action>@(Role:<rid>#members)`

### Decision precedence (invariants — keep these intact)

`Decide` must preserve, exactly as the prototype does:
1. **default-deny** — no reachable grant ⇒ deny.
2. **deny-over-allow** — an explicit `deny` (resolved via Keto's `CheckDeny`) beats any allow.
3. **nearer-role-over-ancestor** and **deny-wins across a user's roles** — implemented in the ported pure
   helpers `roleChain` → `effectiveRoleGrants` → `effectiveUserGrants`.
4. A conditional grant's ABAC conditions are **AND'd together** (all must pass); the attribute bag comes
   from `buildAttrs` (subject.* from the user; `resource.*` from the selected item's overrides, falling back
   to the resource type's declared defaults via `resolveItemAttr`).

### Domain model (`internal/model/model.go`)

Ported from the prototype's in-memory `DB`. Note the distinctions:
- **`ResourceType`** = a class roles get permissions on; **no owner**; `Attrs` *declares* each ABAC
  attribute (`resource.<key>`) and its **default**.
- **`Item`** = a concrete instance with an `Owner` and an `Attrs` map of **per-item overrides** (blank/missing
  inherits the type default).
- **`Role`** has `Parent` (inheritance) and `Grants` mapping `"<resourceKey>:<action>"` → `Effect`.
- **`Effect`** has custom JSON: serializes to exactly `"allow"`, `"deny"`, or an array of condition ids
  `["sod","active"]`. A legacy single-id string is accepted on read. Always go through this type; do not
  emit raw effect JSON elsewhere.
- Grant keys are split with `keto.SplitGrantKey` (uses `LastIndex(":")` because resource keys contain dots,
  e.g. `billing.invoice:approve`).

### Layout

```
cmd/server       service entrypoint (waits for Postgres with retry, then serves)
internal/model   GORM domain types (+ Effect custom JSON)
internal/seed    prototype seed data (also drives the offline engine tests)
internal/store   GORM persistence; Open() runs AutoMigrate; Snapshot/ReplaceAll
internal/keto    Keto gRPC client; SyncAll rebuilds tuples; Check/CheckDeny
internal/engine  decision engine — the decide() port + ABAC evaluation
internal/httpapi chi router; generic crud[T] for the 5 entity types; /check /expand /seed
internal/config  env config (KAM_HTTP_ADDR, KAM_DATABASE_URL, KAM_KETO_READ_URL, KAM_KETO_WRITE_URL)
pkg/sdk          Go client — standard-library only (embeds without pulling in a DB driver)
pkg/middleware   HTTP guard middleware (Guard / RequirePermission)
keto/opl         OPL permission model
examples/        runnable usage samples (basic, middleware)
frontend/        Next.js 16 admin UI (clean architecture) — see Frontend section
deploy/          deployment assets (postgres-init.sql bootstraps the separate `keto` database)
access-control.html  the original single-file prototype this backend ports
```

The HTTP CRUD for all five entities is generated by the generic `crud[T]` helper in `internal/httpapi/api.go`;
every mutating handler re-syncs Keto. The Keto client talks **gRPC** (not REST) even though the env vars are
named like URLs — `grpcTarget` strips any `http://` scheme.

## Frontend (`frontend/`)

The KAM admin UI: **Next.js 16 (App Router) + Tailwind v4 + shadcn-style primitives**, organized in
**clean architecture** — `core/domain` ← `core/application` ← `infrastructure`/`presentation`, wired in
`src/composition/container.ts`. Server state flows through TanStack Query hooks.

- **No direct browser → Go calls.** The browser hits the Next route-handler proxy at
  `src/app/api/kam/[...path]/route.ts`, which forwards `/api/kam/<path>` → `${KAM_API_BASE_URL}/v1/<path>`
  (default `http://localhost:8080`). This keeps the backend origin server-side and sidesteps CORS. The Go
  service does no auth, so the proxy forwards method + body + a JSON content-type only.
- Pages mirror the entity model: `resource-types`, `items`, `roles`, `users`, `conditions`, plus `expand`
  and `playground` (the live decision tester).
- **Build-tooling gotcha:** ESLint 9 + Next 16 + `FlatCompat`/`eslint-config-next` crashes ("Converting
  circular structure to JSON"). `eslint.config.mjs` works around it by using `@next/eslint-plugin-next`'s
  flat `configs.recommended` + `configs["core-web-vitals"]` directly with `@typescript-eslint/parser`.
- Styled to the **K Labs Design System** (Stone Edition).

## Conventions

- Keep the Go engine **behavior-compatible with `decide()` in `access-control.html`** — the helpers carry
  "ports X()" comments tying them back to the prototype function.
- After any config mutation: persist to Postgres, then call `keto.SyncAll` to rebuild tuples. Keto is never
  the source of truth.
- `.claude/settings.json` disables the Playwright plugin for this project.
