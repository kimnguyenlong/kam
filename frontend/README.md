# KAM Admin UI

Admin console for the KAM access-control service (RBAC + ABAC). Next.js (App Router) +
Tailwind v4 + shadcn-style primitives, styled to the **K Labs Design System** (Stone Edition),
organized with **clean architecture**.

## Run

```bash
# 1. start the Go backend (from the repo root)
docker compose up --build            # kam on :8080

# 2. start the admin UI
cd frontend
cp .env.example .env.local           # set KAM_API_BASE_URL if not localhost:8080
npm install
npm run dev                          # http://localhost:3000
```

Open the app, hit **Seed prototype data** on the overview, and the five entity tables fill in.

| Script              | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | dev server (Turbopack)                |
| `npm run build`     | production build                      |
| `npm run lint`      | ESLint (flat config, Next plugin)     |
| `npm run typecheck` | `tsc --noEmit`                        |

## Configuration

| Env var            | Default                 | Notes                                          |
| ------------------ | ----------------------- | ---------------------------------------------- |
| `KAM_API_BASE_URL` | `http://localhost:8080` | Go service base URL. **Server-only** — read by the proxy route handler, never shipped to the browser. |

## Architecture (clean architecture)

Dependencies point inward: `domain` ← `application` ← (`infrastructure`, `presentation`).
Use-cases depend only on repository **ports**; HTTP details live at the edge; the composition
root is the single place they're wired.

```
src/
  core/
    domain/         entities, value objects (Effect, GrantKey), repository ports
    application/    use-cases (CRUD, decisions) — pure, framework-free
  infrastructure/   KamHttpClient, wire<->domain mappers, HTTP repositories, server config
  composition/      container.ts — DI root (the only infra→app wiring)
  presentation/
    components/ui/   shadcn-style primitives built on K Labs tokens (the local core library)
    components/kam/  composed admin pieces (AppShell, DataTable, GrantMatrixEditor, …)
    hooks/           TanStack Query hooks over the use-cases
    providers/       QueryProvider
  lib/              cn(), query keys
  app/              Next routes + the /api/kam proxy route handler
```

### Backend boundary

The browser talks only to `/api/kam/*`, a Next **route-handler proxy**
(`src/app/api/kam/[...path]/route.ts`) that forwards to `${KAM_API_BASE_URL}/v1/*`
server-side. This keeps the backend origin off the client and avoids CORS (the Go service
has no CORS config).

### Wire invariants (mirrored from the Go `internal/model`)

- **Effect** serializes as exactly `"allow"`, `"deny"`, or `["sod","active"]` (condition ids);
  a legacy single-id string is accepted on read. See `infrastructure/mappers/effect-mapper.ts`.
- **Grant keys** are `<resourceKey>:<action>`, split on the **last** colon (resource keys
  contain dots, e.g. `billing.invoice:approve`). See `domain/value-objects/grant-key.ts`.
- **Item attributes** are per-item overrides; a blank value inherits the resource type's
  declared default (surfaced as a placeholder in the item form).

The engine stays authoritative server-side — the UI never re-implements `decide()`.

## Design system

K Labs tokens (colors/typography/radius/elevation/motion) are ported into
`src/app/globals.css` and mapped onto shadcn's semantic variables (`--background`,
`--primary`, `--border`, `--ring`, …). Fonts (Space Grotesk / Geist / JetBrains Mono) load via
`next/font`. The `components/ui` primitives are the local core library built on those tokens;
everything in `components/kam` is composed on top. Stone Edition is light-only (no dark mode).

## Pages

Overview (counts + seed) · Resource Types · Items · Conditions · Roles (grant matrix editor) ·
Users · Playground (`/check` with decision trace) · Expand (`/expand` effective grants).
