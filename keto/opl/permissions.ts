// KAM permission model — Ory Permission Language (OPL).
//
// This expresses the RBAC layer of the prototype (access-control.html):
//   * Role membership and role inheritance.
//   * Per-action allow grants and deny grants from roles to resource TYPES.
//
// ABAC conditions (attribute comparisons such as subject.clearance >= resource.sensitivity)
// and deny/allow precedence are NOT expressible in Keto; the KAM Go engine overlays those
// on top of the boolean checks this model answers. See internal/engine.
//
// Object ids:
//   * User      -> user id            (e.g. "u2")
//   * Role      -> role id            (e.g. "r_fin")
//   * Resource  -> resource type key  (e.g. "billing.invoice")
//
// Tuples written by internal/keto.SyncAll:
//   * membership:   Role:<id>#members@User:<uid>
//   * inheritance:  Role:<parent>#members@(Role:<child>#members)   // nested groups
//   * allow grant:  Resource:<key>#<action>@(Role:<rid>#members)
//   * deny  grant:  Resource:<key>#deny_<action>@(Role:<rid>#members)

import { Namespace, SubjectSet, Context } from "@ory/keto-namespace-types"

class User implements Namespace {}

class Role implements Namespace {
  related: {
    // A member is either a User directly, or every member of a child role
    // (nested-group inheritance: a member of r_sales is also a member of r_base).
    members: (User | SubjectSet<Role, "members">)[]
  }

  permits = {
    member: (ctx: Context): boolean => this.related.members.includes(ctx.subject),
  }
}

class Resource implements Namespace {
  related: {
    // allow grants — one relation per action in ACTIONS_LIB
    create: SubjectSet<Role, "members">[]
    read: SubjectSet<Role, "members">[]
    update: SubjectSet<Role, "members">[]
    delete: SubjectSet<Role, "members">[]
    list: SubjectSet<Role, "members">[]
    approve: SubjectSet<Role, "members">[]
    export: SubjectSet<Role, "members">[]
    share: SubjectSet<Role, "members">[]
    admin: SubjectSet<Role, "members">[]

    // deny grants — one relation per action
    deny_create: SubjectSet<Role, "members">[]
    deny_read: SubjectSet<Role, "members">[]
    deny_update: SubjectSet<Role, "members">[]
    deny_delete: SubjectSet<Role, "members">[]
    deny_list: SubjectSet<Role, "members">[]
    deny_approve: SubjectSet<Role, "members">[]
    deny_export: SubjectSet<Role, "members">[]
    deny_share: SubjectSet<Role, "members">[]
    deny_admin: SubjectSet<Role, "members">[]
  }

  permits = {
    // base RBAC reachability for each action (inheritance resolved via Role#member)
    create: (ctx: Context): boolean => this.related.create.includes(ctx.subject),
    read: (ctx: Context): boolean => this.related.read.includes(ctx.subject),
    update: (ctx: Context): boolean => this.related.update.includes(ctx.subject),
    delete: (ctx: Context): boolean => this.related.delete.includes(ctx.subject),
    list: (ctx: Context): boolean => this.related.list.includes(ctx.subject),
    approve: (ctx: Context): boolean => this.related.approve.includes(ctx.subject),
    export: (ctx: Context): boolean => this.related.export.includes(ctx.subject),
    share: (ctx: Context): boolean => this.related.share.includes(ctx.subject),
    admin: (ctx: Context): boolean => this.related.admin.includes(ctx.subject),

    // deny reachability (deny-over-allow is applied by the Go engine)
    deny_create: (ctx: Context): boolean => this.related.deny_create.includes(ctx.subject),
    deny_read: (ctx: Context): boolean => this.related.deny_read.includes(ctx.subject),
    deny_update: (ctx: Context): boolean => this.related.deny_update.includes(ctx.subject),
    deny_delete: (ctx: Context): boolean => this.related.deny_delete.includes(ctx.subject),
    deny_list: (ctx: Context): boolean => this.related.deny_list.includes(ctx.subject),
    deny_approve: (ctx: Context): boolean => this.related.deny_approve.includes(ctx.subject),
    deny_export: (ctx: Context): boolean => this.related.deny_export.includes(ctx.subject),
    deny_share: (ctx: Context): boolean => this.related.deny_share.includes(ctx.subject),
    deny_admin: (ctx: Context): boolean => this.related.deny_admin.includes(ctx.subject),
  }
}
