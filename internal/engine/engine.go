// Package engine is the decision engine. It faithfully ports decide() from
// access-control.html: default-deny, deny-over-allow, and ABAC conditions AND'd together.
//
// The RBAC reachability (role resolution + inheritance + allow/deny grants) is answered by
// Ory Keto's Check API; this engine selects the applicable ABAC conditions from Postgres,
// evaluates them in Go, applies precedence, and produces the decision trace.
package engine

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"github.com/kimnguyenlong/kam/internal/model"
)

// Step is one entry in a decision trace (mirrors the prototype trace items).
type Step struct {
	Kind   string `json:"kind"` // info | ok | no | warn
	Title  string `json:"title"`
	Detail string `json:"detail"`
}

// Decision is the result of decide().
type Decision struct {
	Allow  bool   `json:"allow"`
	Reason string `json:"reason"`
	Trace  []Step `json:"trace"`
}

// Grant is an effective grant for a key, with provenance (ports effectiveUserGrants info).
type Grant struct {
	Effect    model.Effect
	Source    string // role the grant was authored on
	Inherited bool   // true if Source is an ancestor of the assigned role
	ViaRole   string // the user's assigned role that produced it
}

type store interface {
	UserByID(ctx context.Context, id string) (*model.User, error)
	ResourceTypeByKey(ctx context.Context, key string) (*model.ResourceType, error)
	ItemByID(ctx context.Context, id string) (*model.Item, error)
	Roles(ctx context.Context) ([]model.Role, error)
	Conditions(ctx context.Context) ([]model.Condition, error)
}

type checker interface {
	Check(ctx context.Context, resKey, action, userID string) (bool, error)
	CheckDeny(ctx context.Context, resKey, action, userID string) (bool, error)
}

// Engine evaluates access decisions.
type Engine struct {
	store store
	keto  checker
}

// New builds an Engine.
func New(s store, k checker) *Engine { return &Engine{store: s, keto: k} }

// ErrNotFound is returned when the subject or resource type does not exist.
var ErrNotFound = errors.New("not found")

// Decide evaluates whether userID may perform action on resource type resKey, using itemID
// (optional) to supply resource.* attribute values and resource.owner for ABAC conditions.
func (e *Engine) Decide(ctx context.Context, userID, resKey, action, itemID string) (*Decision, error) {
	u, err := e.store.UserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("%w: user %q", ErrNotFound, userID)
		}
		return nil, err
	}
	res, err := e.store.ResourceTypeByKey(ctx, resKey)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("%w: resource type %q", ErrNotFound, resKey)
		}
		return nil, err
	}
	roles, err := e.store.Roles(ctx)
	if err != nil {
		return nil, err
	}
	conds, err := e.store.Conditions(ctx)
	if err != nil {
		return nil, err
	}
	roleByID := indexRoles(roles)
	condByID := indexConds(conds)

	resName := res.Name
	var trace []Step

	// Header (ports the first two trace pushes).
	roleNames := make([]string, 0, len(u.Roles))
	for _, rid := range u.Roles {
		if r, ok := roleByID[rid]; ok {
			roleNames = append(roleNames, r.Name)
		}
	}
	trace = append(trace, Step{"info", "Subject: " + u.Name,
		fmt.Sprintf("Department: %s · Roles: %s", u.Dept, strings.Join(roleNames, ", "))})

	effRoles := resolvedRoleNames(u, roleByID)
	trace = append(trace, Step{"info", "Resolved role hierarchy",
		"Effective roles (incl. inherited): " + strings.Join(effRoles, ", ")})

	// DB-computed effective grant: used for trace provenance and condition selection.
	// Precedence (deny-wins, nearest-role-over-ancestor) matches the prototype exactly.
	grants := effectiveUserGrants(u, roleByID)
	match, hasMatch := grants[resKey+":"+action]

	// Authoritative RBAC reachability comes from Keto (resolves inheritance).
	denied, err := e.keto.CheckDeny(ctx, resKey, action, userID)
	if err != nil {
		return nil, err
	}
	allowed, err := e.keto.Check(ctx, resKey, action, userID)
	if err != nil {
		return nil, err
	}

	// Explicit deny wins over any allow (Keto resolved the role hierarchy).
	if denied {
		if hasMatch {
			trace = append(trace, Step{"info", "Matched grant",
				fmt.Sprintf("Rule %q via role %s%s.", condLabel(match.Effect, condByID), match.ViaRole, inheritedNote(match))})
		}
		trace = append(trace, Step{"no", "Explicit DENY",
			"A deny rule (resolved via Keto) overrides any allow. Access blocked."})
		return &Decision{Allow: false, Reason: "Explicit deny rule takes precedence", Trace: trace}, nil
	}

	// No grant reachable -> default deny.
	if !allowed {
		trace = append(trace, Step{"no", "No grant for " + resKey + ":" + action,
			fmt.Sprintf("Default-deny: no role grants %s on %s.", action, resName)})
		return &Decision{Allow: false, Reason: "No matching permission (default deny)", Trace: trace}, nil
	}

	trace = append(trace, Step{"info", "Matched grant",
		fmt.Sprintf("Rule %q via role %s%s (RBAC reachability confirmed by Keto).",
			condLabel(match.Effect, condByID), match.ViaRole, inheritedNote(match))})

	// Unconditional allow.
	if match.Effect.Kind == model.EffectAllow {
		trace = append(trace, Step{"ok", "Unconditional allow", "Permission granted directly."})
		trace = append(trace, Step{"ok", "Access ALLOWED", fmt.Sprintf("All checks passed for %s on %s.", action, resName)})
		return &Decision{Allow: true, Reason: "unconditional grant", Trace: trace}, nil
	}

	// Conditional grant: every assigned ABAC condition must pass (AND).
	item, _ := e.loadItem(ctx, itemID)
	attrs := buildAttrs(u, res, item)
	ids := match.Effect.CondIDs()
	allPass := true
	var firstFail string
	for _, id := range ids {
		pass, reason := evalCondition(id, attrs, condByID)
		kind := "ok"
		mark := "✔ "
		if !pass {
			kind, mark = "warn", "✘ "
		}
		trace = append(trace, Step{kind, "ABAC condition: " + condLabelIDs([]string{id}, condByID), mark + reason + "."})
		if !pass && allPass {
			allPass = false
			firstFail = reason
		}
	}

	if allPass {
		reason := "granted"
		if len(ids) > 1 {
			reason = fmt.Sprintf("all %d conditions met", len(ids))
		} else if len(ids) == 1 {
			reason = "condition met"
		}
		detail := "Condition passed"
		if len(ids) > 1 {
			detail = fmt.Sprintf("All %d conditions passed", len(ids))
		}
		trace = append(trace, Step{"ok", "Access ALLOWED", fmt.Sprintf("%s for %s on %s.", detail, action, resName)})
		return &Decision{Allow: true, Reason: reason, Trace: trace}, nil
	}
	reason := firstFail
	if len(ids) > 1 {
		reason = fmt.Sprintf("not all conditions met (%s)", firstFail)
	}
	trace = append(trace, Step{"no", "Access DENIED", "Condition not satisfied: " + firstFail + "."})
	return &Decision{Allow: false, Reason: reason, Trace: trace}, nil
}

func (e *Engine) loadItem(ctx context.Context, itemID string) (*model.Item, error) {
	if itemID == "" {
		return nil, nil
	}
	return e.store.ItemByID(ctx, itemID)
}

// ExpandUser returns the effective grants for a user (ports effectiveUserGrants for /expand).
func (e *Engine) ExpandUser(ctx context.Context, userID string) (map[string]Grant, error) {
	u, err := e.store.UserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("%w: user %q", ErrNotFound, userID)
		}
		return nil, err
	}
	roles, err := e.store.Roles(ctx)
	if err != nil {
		return nil, err
	}
	return effectiveUserGrants(u, indexRoles(roles)), nil
}

// ---- ported pure helpers ----

func indexRoles(rs []model.Role) map[string]model.Role {
	m := make(map[string]model.Role, len(rs))
	for _, r := range rs {
		m[r.ID] = r
	}
	return m
}

func indexConds(cs []model.Condition) map[string]model.Condition {
	m := make(map[string]model.Condition, len(cs))
	for _, c := range cs {
		m[c.ID] = c
	}
	return m
}

// roleChain returns the ancestry of a role (self first, then parents). Ports roleChain().
func roleChain(id string, byID map[string]model.Role) []model.Role {
	var chain []model.Role
	seen := map[string]bool{}
	cur, ok := byID[id]
	for ok && !seen[cur.ID] {
		seen[cur.ID] = true
		chain = append(chain, cur)
		if cur.Parent == nil || *cur.Parent == "" {
			break
		}
		cur, ok = byID[*cur.Parent]
	}
	return chain
}

// effectiveRoleGrants flattens a role's chain so nearer roles override ancestors.
// Ports effectiveRoleGrants().
func effectiveRoleGrants(id string, byID map[string]model.Role) map[string]Grant {
	out := map[string]Grant{}
	chain := roleChain(id, byID)
	for i := len(chain) - 1; i >= 0; i-- {
		r := chain[i]
		for k, eff := range r.Grants {
			out[k] = Grant{Effect: eff, Source: r.Name, Inherited: r.ID != id}
		}
	}
	return out
}

// effectiveUserGrants merges grants across a user's roles with deny-wins. Ports
// effectiveUserGrants().
func effectiveUserGrants(u *model.User, byID map[string]model.Role) map[string]Grant {
	out := map[string]Grant{}
	for _, rid := range u.Roles {
		via := byID[rid].Name
		for k, info := range effectiveRoleGrants(rid, byID) {
			info.ViaRole = via
			if existing, ok := out[k]; ok {
				if info.Effect.Kind == model.EffectDeny {
					out[k] = info
				} else if existing.Effect.Kind != model.EffectDeny {
					out[k] = info
				}
			} else {
				out[k] = info
			}
		}
	}
	return out
}

func resolvedRoleNames(u *model.User, byID map[string]model.Role) []string {
	seen := map[string]bool{}
	var names []string
	for _, rid := range u.Roles {
		for _, r := range roleChain(rid, byID) {
			if !seen[r.Name] {
				seen[r.Name] = true
				names = append(names, r.Name)
			}
		}
	}
	return names
}

func inheritedNote(g Grant) string {
	if g.Inherited {
		return " (inherited from " + g.Source + ")"
	}
	return ""
}

// ---- condition labelling & evaluation (ported) ----

var opSym = map[string]string{
	"eq": "=", "neq": "≠", "gt": ">", "gte": "≥", "lt": "<", "lte": "≤", "in": "∈",
}

// condLabel labels any grant effect (ports condLabel()).
func condLabel(eff model.Effect, byID map[string]model.Condition) string {
	switch eff.Kind {
	case model.EffectAllow:
		return "Always"
	case model.EffectDeny:
		return "Explicit DENY"
	default:
		return condLabelIDs(eff.CondIDs(), byID)
	}
}

func condLabelIDs(ids []string, byID map[string]model.Condition) string {
	parts := make([]string, 0, len(ids))
	for _, id := range ids {
		if c, ok := byID[id]; ok {
			parts = append(parts, c.Label)
		} else {
			parts = append(parts, id)
		}
	}
	return strings.Join(parts, " + ")
}

func condExpr(c model.Condition) string {
	op := opSym[c.Op]
	if op == "" {
		op = c.Op
	}
	right := c.Right
	if c.RightType == "literal" {
		right = `"` + c.Right + `"`
	}
	return fmt.Sprintf("%s %s %s", c.Left, op, right)
}

func fmtVal(v any) string {
	if v == nil {
		return "∅"
	}
	s := toStr(v)
	if s == "" {
		return "∅"
	}
	return s
}

// evalCondition evaluates one condition id against the attribute bag (ports evalCondition()).
func evalCondition(id string, attrs map[string]any, byID map[string]model.Condition) (bool, string) {
	c, ok := byID[id]
	if !ok {
		return false, "unknown condition"
	}
	lv := attrs[c.Left]
	var rv any
	if c.RightType == "literal" {
		rv = c.Right
	} else {
		rv = attrs[c.Right]
	}
	pass := applyOp(c.Op, lv, rv)
	op := opSym[c.Op]
	if op == "" {
		op = c.Op
	}
	detail := fmt.Sprintf("%s %s %s", fmtVal(lv), op, fmtVal(rv))
	verb := "condition met"
	if !pass {
		verb = "condition not met"
	}
	return pass, fmt.Sprintf("%s: %s → %s", verb, condExpr(c), detail)
}

// applyOp ports applyOp().
func applyOp(op string, l, r any) bool {
	switch op {
	case "eq":
		return toStr(l) == toStr(r)
	case "neq":
		return toStr(l) != toStr(r)
	case "gt":
		return toFloat(l) > toFloat(r)
	case "gte":
		return toFloat(l) >= toFloat(r)
	case "lt":
		return toFloat(l) < toFloat(r)
	case "lte":
		return toFloat(l) <= toFloat(r)
	case "in":
		want := toStr(l)
		for _, s := range strings.Split(toStr(r), ",") {
			if strings.TrimSpace(s) == want {
				return true
			}
		}
		return false
	default:
		return false
	}
}

// resolveItemAttr resolves an item's value for one declared attribute (ports resolveItemAttr()).
func resolveItemAttr(itemAttrs map[string]any, decl model.AttrDecl) any {
	if itemAttrs != nil {
		if v, ok := itemAttrs[decl.Key]; ok && v != nil && toStr(v) != "" {
			return v
		}
	}
	return decl.Value
}

// buildAttrs builds the subject/resource attribute bag for a decision (ports buildAttrs()).
func buildAttrs(u *model.User, res *model.ResourceType, item *model.Item) map[string]any {
	owner := ""
	var itemAttrs map[string]any
	if item != nil {
		owner = item.Owner
		itemAttrs = item.Attrs
	}
	bag := map[string]any{
		"subject.id": u.ID, "subject.name": u.Name, "subject.dept": u.Dept, "subject.email": u.Email,
		"subject.clearance": u.Clearance, "subject.region": u.Region, "subject.status": u.Status,
		"resource.owner": owner,
	}
	for _, a := range res.Attrs {
		bag["resource."+a.Key] = resolveItemAttr(itemAttrs, a)
	}
	return bag
}

func toStr(v any) string {
	switch x := v.(type) {
	case nil:
		return ""
	case string:
		return x
	case float64:
		return strconv.FormatFloat(x, 'g', -1, 64)
	case int:
		return strconv.Itoa(x)
	case bool:
		return strconv.FormatBool(x)
	default:
		return fmt.Sprintf("%v", x)
	}
}

func toFloat(v any) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case int:
		return float64(x)
	case string:
		f, _ := strconv.ParseFloat(strings.TrimSpace(x), 64)
		return f
	case bool:
		if x {
			return 1
		}
		return 0
	default:
		f, _ := strconv.ParseFloat(toStr(v), 64)
		return f
	}
}
