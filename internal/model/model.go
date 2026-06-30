// Package model holds the GORM-backed domain types, ported from the prototype's
// in-memory DB ({resources, items, conditions, roles, users}) in access-control.html.
package model

import (
	"encoding/json"
	"fmt"
)

// ActionsLib is the fixed set of actions the matrix understands (ACTIONS_LIB).
var ActionsLib = []string{
	"create", "read", "update", "delete", "list", "approve", "export", "share", "admin",
}

// AttrDecl is one declared ABAC attribute on a resource type: the key it exposes as
// resource.<key> and the default value used when an item does not override it.
type AttrDecl struct {
	Key   string `json:"key"`
	Value any    `json:"value"`
}

// ResourceType is a class of protected object that roles get permissions on. It has
// no owner; Attrs declares the ABAC attributes (with defaults) it exposes.
type ResourceType struct {
	Key     string     `gorm:"primaryKey" json:"key"`
	Name    string     `json:"name"`
	Domain  string     `json:"domain"`
	Actions []string   `gorm:"serializer:json;type:jsonb" json:"actions"`
	Attrs   []AttrDecl `gorm:"serializer:json;type:jsonb" json:"attrs"`
}

func (ResourceType) TableName() string { return "resource_types" }

// Item is a concrete instance of a ResourceType. Owner lives here (never on the type);
// Attrs holds per-item overrides for the attributes the type declares (a missing or
// blank key inherits the type default).
type Item struct {
	ID    string         `gorm:"primaryKey" json:"id"`
	Name  string         `json:"name"`
	Type  string         `gorm:"index" json:"type"`
	Owner string         `json:"owner"`
	Attrs map[string]any `gorm:"serializer:json;type:jsonb" json:"attrs"`
}

func (Item) TableName() string { return "items" }

// Condition is an ABAC rule evaluated at decision time. Type scopes which resource.*
// attributes it may reference (nil = generic / owner-only).
type Condition struct {
	ID        string  `gorm:"primaryKey" json:"id"`
	Label     string  `json:"label"`
	Type      *string `json:"type"`
	Left      string  `json:"left"`
	Op        string  `json:"op"`
	RightType string  `json:"rightType"` // "attr" | "literal"
	Right     string  `json:"right"`
}

func (Condition) TableName() string { return "conditions" }

// Role forms an inheritance tree via Parent. Grants maps "<resourceKey>:<action>" to an
// Effect (allow / deny / list of condition ids).
type Role struct {
	ID     string           `gorm:"primaryKey" json:"id"`
	Name   string           `json:"name"`
	Desc   string           `json:"desc"`
	Parent *string          `json:"parent"`
	Grants map[string]Effect `gorm:"serializer:json;type:jsonb" json:"grants"`
}

func (Role) TableName() string { return "roles" }

// User is a subject. Roles is the set of role ids assigned to the user.
type User struct {
	ID        string   `gorm:"primaryKey" json:"id"`
	Name      string   `json:"name"`
	Email     string   `json:"email"`
	Dept      string   `json:"dept"`
	Clearance int      `json:"clearance"`
	Region    string   `json:"region"`
	Status    string   `json:"status"`
	Roles     []string `gorm:"serializer:json;type:jsonb" json:"roles"`
}

func (User) TableName() string { return "users" }

// EffectKind classifies a grant effect.
type EffectKind int

const (
	EffectAllow EffectKind = iota
	EffectDeny
	EffectConditional
)

// Effect is a grant effect. It serializes to exactly the prototype's JSON shape:
// the string "allow", the string "deny", or an array of condition ids ["sod","active"].
// A legacy single condition-id string is accepted on read and normalized to a one-element list.
type Effect struct {
	Kind  EffectKind
	Conds []string
}

// Allow / Deny / Conditional constructors.
func Allow() Effect                  { return Effect{Kind: EffectAllow} }
func Deny() Effect                   { return Effect{Kind: EffectDeny} }
func Conditional(ids ...string) Effect { return Effect{Kind: EffectConditional, Conds: ids} }

// CondIDs returns the condition ids for a conditional effect, or nil for allow/deny.
// Ports condIds().
func (e Effect) CondIDs() []string {
	if e.Kind == EffectConditional {
		return e.Conds
	}
	return nil
}

func (e Effect) MarshalJSON() ([]byte, error) {
	switch e.Kind {
	case EffectAllow:
		return json.Marshal("allow")
	case EffectDeny:
		return json.Marshal("deny")
	case EffectConditional:
		return json.Marshal(e.Conds)
	default:
		return nil, fmt.Errorf("model: invalid effect kind %d", e.Kind)
	}
}

func (e *Effect) UnmarshalJSON(b []byte) error {
	// Try a string first: "allow" / "deny" / legacy single condition id.
	var s string
	if err := json.Unmarshal(b, &s); err == nil {
		switch s {
		case "allow":
			*e = Allow()
		case "deny":
			*e = Deny()
		case "":
			return fmt.Errorf("model: empty effect string")
		default:
			*e = Conditional(s)
		}
		return nil
	}
	// Otherwise an array of condition ids.
	var ids []string
	if err := json.Unmarshal(b, &ids); err != nil {
		return fmt.Errorf("model: invalid effect %s: %w", string(b), err)
	}
	*e = Conditional(ids...)
	return nil
}

// DB is a full snapshot of configuration, mirroring the prototype's DB object. Used by
// the seed loader and the Keto sync layer.
type DB struct {
	Resources  []ResourceType `json:"resources"`
	Items      []Item         `json:"items"`
	Conditions []Condition    `json:"conditions"`
	Roles      []Role         `json:"roles"`
	Users      []User         `json:"users"`
}
