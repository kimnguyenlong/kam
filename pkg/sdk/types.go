package sdk

import (
	"encoding/json"
	"fmt"
)

// These wire types mirror the KAM service JSON. They are declared here (rather than
// imported from the server's internal packages) so consumers of the SDK take no
// dependency on GORM or the service internals.

// CheckRequest asks whether UserID may perform Action on ResourceType. ItemID is optional
// and supplies resource.* attribute values (and resource.owner) for ABAC conditions.
type CheckRequest struct {
	UserID       string `json:"userId"`
	ResourceType string `json:"resourceType"`
	Action       string `json:"action"`
	ItemID       string `json:"itemId,omitempty"`
}

// Step is one entry in a decision trace.
type Step struct {
	Kind   string `json:"kind"` // info | ok | no | warn
	Title  string `json:"title"`
	Detail string `json:"detail"`
}

// Decision is the result of a check: the verdict, a one-line reason, and the full trace.
type Decision struct {
	Allow  bool   `json:"allow"`
	Reason string `json:"reason"`
	Trace  []Step `json:"trace"`
}

// AttrDecl is a declared ABAC attribute on a resource type (key + default value).
type AttrDecl struct {
	Key   string `json:"key"`
	Value any    `json:"value"`
}

// ResourceType is a class of protected object.
type ResourceType struct {
	Key     string     `json:"key"`
	Name    string     `json:"name"`
	Domain  string     `json:"domain"`
	Actions []string   `json:"actions"`
	Attrs   []AttrDecl `json:"attrs"`
}

// Item is a concrete instance of a ResourceType.
type Item struct {
	ID    string         `json:"id"`
	Name  string         `json:"name"`
	Type  string         `json:"type"`
	Owner string         `json:"owner"`
	Attrs map[string]any `json:"attrs"`
}

// Condition is an ABAC rule.
type Condition struct {
	ID        string  `json:"id"`
	Label     string  `json:"label"`
	Type      *string `json:"type"`
	Left      string  `json:"left"`
	Op        string  `json:"op"`
	RightType string  `json:"rightType"`
	Right     string  `json:"right"`
}

// Role is an RBAC role with optional parent and a grant map.
type Role struct {
	ID     string            `json:"id"`
	Name   string            `json:"name"`
	Desc   string            `json:"desc"`
	Parent *string           `json:"parent"`
	Grants map[string]Effect `json:"grants"`
}

// User is a subject with assigned roles.
type User struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Email     string   `json:"email"`
	Dept      string   `json:"dept"`
	Clearance int      `json:"clearance"`
	Region    string   `json:"region"`
	Status    string   `json:"status"`
	Roles     []string `json:"roles"`
}

// EffectKind classifies a grant effect.
type EffectKind int

const (
	EffectAllow EffectKind = iota
	EffectDeny
	EffectConditional
)

// Effect is a grant effect, serialized as "allow", "deny", or a list of condition ids.
type Effect struct {
	Kind  EffectKind
	Conds []string
}

// Allow / Deny / Conditional constructors.
func Allow() Effect                     { return Effect{Kind: EffectAllow} }
func Deny() Effect                      { return Effect{Kind: EffectDeny} }
func Conditional(ids ...string) Effect  { return Effect{Kind: EffectConditional, Conds: ids} }

func (e Effect) MarshalJSON() ([]byte, error) {
	switch e.Kind {
	case EffectAllow:
		return json.Marshal("allow")
	case EffectDeny:
		return json.Marshal("deny")
	case EffectConditional:
		return json.Marshal(e.Conds)
	default:
		return nil, fmt.Errorf("sdk: invalid effect kind %d", e.Kind)
	}
}

func (e *Effect) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err == nil {
		switch s {
		case "allow":
			*e = Allow()
		case "deny":
			*e = Deny()
		default:
			*e = Conditional(s)
		}
		return nil
	}
	var ids []string
	if err := json.Unmarshal(b, &ids); err != nil {
		return fmt.Errorf("sdk: invalid effect %s: %w", string(b), err)
	}
	*e = Conditional(ids...)
	return nil
}
