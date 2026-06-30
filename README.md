# KAM — Access Control Manager (Go backend)

A backend port of the `access-control.html` prototype: an **RBAC + ABAC** access-control service.
It uses **Ory Keto** (with a model written in **OPL**, the Ory Permission Language) as the permission
evaluation engine for the relationship/RBAC layer, and overlays **ABAC conditions** and precedence in Go.

The service performs **no authentication** — callers pass an already-authenticated subject id.

- Module: `github.com/kimnguyenlong/kam`
- Storage: **PostgreSQL** via **GORM**
- Permission engine: **Ory Keto** + **OPL**
- Ships a **Go SDK** (`pkg/sdk`) and **HTTP guard middleware** (`pkg/middleware`)

## Architecture

```
            ┌─────────── KAM service (cmd/server) ───────────┐
 consumer → │  HTTP API (chi)                                │
  service   │    /v1/check  /v1/expand  /v1/seed  CRUD        │
 (via SDK)  │        │                                       │
            │        ▼                                        │
            │   engine.Decide ──ABAC + precedence (Go)        │
            │        │                                        │
            │        ├── RBAC reachability ──► Ory Keto ──► OPL model
            │        │   (Check / CheckDeny)    (relation tuples)
            │        └── config + attributes ─► PostgreSQL (GORM)
            └────────────────────────────────────────────────┘
```

**Why hybrid?** Keto is a Zanzibar/ReBAC engine: it resolves relationships (role membership, inheritance,
role→action grants) but cannot express attribute comparisons (`subject.clearance ≥ resource.sensitivity`)
or deny-override. So:

- **Keto + OPL own the RBAC layer.** Postgres is the source of truth; every config mutation re-syncs relation
  tuples into Keto (`internal/keto.SyncAll`). `Check` / `CheckDeny` answer the base reachability questions.
- **The Go engine overlays ABAC + precedence** (`internal/engine`), faithfully porting `decide()`:
  **default-deny**, **deny-over-allow**, and ABAC conditions **AND**'d together.

### The permission model

- **Resource types** declare `actions` and ABAC `attrs` (key + default). **Items** are instances with an
  `owner` and per-item attribute overrides (blank inherits the type default).
- **Roles** form an inheritance tree via `parent`; `grants` map `"<resourceKey>:<action>"` to an effect:
  `allow`, `deny`, or a list of ABAC condition ids (all must pass).
- **Conditions** are attribute rules: `left <op> right`, where `op ∈ {eq,neq,gt,gte,lt,lte,in}` and `right`
  is a literal or another attribute (`resource.*` / `subject.*`).
- **Decision precedence:** no grant → deny; explicit `deny` (resolved via Keto) beats any allow; otherwise the
  conditional grant's conditions are evaluated against the item's attributes.

The OPL model lives in [`keto/opl/permissions.ts`](keto/opl/permissions.ts).

## Run it locally

```bash
docker compose up --build        # postgres + keto (migrated, OPL loaded) + kam
curl -XPOST localhost:8080/v1/seed   # load the prototype seed data and sync tuples
```

Then a check:

```bash
curl -s -XPOST localhost:8080/v1/check -H 'content-type: application/json' -d '{
  "userId":"u4","resourceType":"infra.secret","action":"read","itemId":"i_sec1"
}' | jq
```

## SDK

```go
import "github.com/kimnguyenlong/kam/pkg/sdk"

client := sdk.New("http://localhost:8080")
dec, _ := client.Check(ctx, sdk.CheckRequest{
    UserID: "u2", ResourceType: "billing.invoice", Action: "approve", ItemID: "i_inv1",
})
fmt.Println(dec.Allow, dec.Reason) // false, "not all conditions met (...)"
```

The SDK is standard-library only — embedding it (or the middleware) pulls in no database driver.

## HTTP guard middleware

Guard a downstream service's routes; the host service supplies the authenticated subject id (default header
`X-Subject-ID`), and the middleware maps the HTTP method to a KAM action:

```go
import "github.com/kimnguyenlong/kam/pkg/middleware"

guard := middleware.Guard(middleware.Config{
    Client:       sdk.New("http://localhost:8080"),
    ResourceType: middleware.Static("billing.invoice"),
    Item:         middleware.HeaderValue("X-Invoice-ID"), // optional per-item ABAC
})
mux.Handle("/invoices", guard(billingHandler))
// or, for a fixed route:
mux.Handle("/admin", middleware.RequirePermission(client, "infra.cluster", "admin")(adminHandler))
```

## Examples

- [`examples/basic`](examples/basic) — seed the service and run prototype scenarios, printing decision traces.
- [`examples/middleware`](examples/middleware) — a tiny billing service guarded by KAM.

```bash
go run ./examples/basic        # against a running, seeded stack
go run ./examples/middleware   # then: curl -H 'X-Subject-ID: u2' localhost:9090/invoices
```

## HTTP API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/v1/check` | Evaluate access → `{allow, reason, trace}` |
| `POST` | `/v1/expand` | A user's effective grants |
| `POST` | `/v1/seed` | Load prototype seed data + sync Keto |
| `GET/PUT/DELETE` | `/v1/resource-types[/{key}]` | Resource type CRUD |
| `GET/PUT/DELETE` | `/v1/items[/{id}]` | Item CRUD |
| `GET/PUT/DELETE` | `/v1/conditions[/{id}]` | ABAC condition CRUD |
| `GET/PUT/DELETE` | `/v1/roles[/{id}]` | Role + grant CRUD |
| `GET/PUT/DELETE` | `/v1/users[/{id}]` | User + role-assignment CRUD |
| `GET` | `/healthz` | Liveness |

Every mutation re-syncs the RBAC tuples into Keto.

## Layout

```
cmd/server            service entrypoint
internal/model        GORM domain types (+ Effect JSON)
internal/seed         prototype seed data
internal/store        GORM persistence
internal/keto         Keto gRPC client + tuple sync
internal/engine       decision engine (decide port + ABAC)
internal/httpapi      chi router, CRUD, /check
internal/config       env config
pkg/sdk               Go client (std-lib only)
pkg/middleware        HTTP guard middleware
keto/opl              OPL permission model
examples/             runnable usage samples
```

## Configuration (env)

| Var | Default | Meaning |
| --- | --- | --- |
| `KAM_HTTP_ADDR` | `:8080` | Listen address |
| `KAM_DATABASE_URL` | `postgres://kam:kam@localhost:5432/kam?sslmode=disable` | Postgres DSN |
| `KAM_KETO_READ_URL` | `localhost:4466` | Keto read API (check), gRPC target |
| `KAM_KETO_WRITE_URL` | `localhost:4467` | Keto write API (tuples), gRPC target |
