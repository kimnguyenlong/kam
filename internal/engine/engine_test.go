package engine

import (
	"context"
	"testing"

	"github.com/kimnguyenlong/kam/internal/model"
	"github.com/kimnguyenlong/kam/internal/seed"
)

// fakeStore serves the prototype seed data from memory.
type fakeStore struct{ db model.DB }

func newFakeStore() *fakeStore { return &fakeStore{db: seed.DB()} }

func (f *fakeStore) UserByID(_ context.Context, id string) (*model.User, error) {
	for i := range f.db.Users {
		if f.db.Users[i].ID == id {
			return &f.db.Users[i], nil
		}
	}
	return nil, errNF
}
func (f *fakeStore) ResourceTypeByKey(_ context.Context, key string) (*model.ResourceType, error) {
	for i := range f.db.Resources {
		if f.db.Resources[i].Key == key {
			return &f.db.Resources[i], nil
		}
	}
	return nil, errNF
}
func (f *fakeStore) ItemByID(_ context.Context, id string) (*model.Item, error) {
	for i := range f.db.Items {
		if f.db.Items[i].ID == id {
			return &f.db.Items[i], nil
		}
	}
	return nil, errNF
}
func (f *fakeStore) Roles(_ context.Context) ([]model.Role, error)           { return f.db.Roles, nil }
func (f *fakeStore) Conditions(_ context.Context) ([]model.Condition, error) { return f.db.Conditions, nil }

type notFound struct{}

func (notFound) Error() string { return "not found" }

var errNF = notFound{}

// fakeKeto independently simulates Keto's reachability: it walks the user's roles (with
// inheritance) and reports whether any grants the action (allow/conditional) or denies it.
// This mirrors what internal/keto.SyncAll writes and Keto's Check resolves.
type fakeKeto struct{ db model.DB }

func (k fakeKeto) reach(userID, resKey, action string, deny bool) bool {
	byID := map[string]model.Role{}
	for _, r := range k.db.Roles {
		byID[r.ID] = r
	}
	var user *model.User
	for i := range k.db.Users {
		if k.db.Users[i].ID == userID {
			user = &k.db.Users[i]
		}
	}
	if user == nil {
		return false
	}
	key := resKey + ":" + action
	seen := map[string]bool{}
	var visit func(id string) bool
	visit = func(id string) bool {
		for !seen[id] {
			seen[id] = true
			r, ok := byID[id]
			if !ok {
				return false
			}
			if eff, ok := r.Grants[key]; ok {
				if deny && eff.Kind == model.EffectDeny {
					return true
				}
				if !deny && eff.Kind != model.EffectDeny {
					return true
				}
			}
			if r.Parent == nil || *r.Parent == "" {
				return false
			}
			id = *r.Parent
		}
		return false
	}
	for _, rid := range user.Roles {
		if visit(rid) {
			return true
		}
		seen = map[string]bool{}
	}
	return false
}

func (k fakeKeto) Check(_ context.Context, resKey, action, userID string) (bool, error) {
	return k.reach(userID, resKey, action, false), nil
}
func (k fakeKeto) CheckDeny(_ context.Context, resKey, action, userID string) (bool, error) {
	return k.reach(userID, resKey, action, true), nil
}

func TestDecideScenarios(t *testing.T) {
	fs := newFakeStore()
	eng := New(fs, fakeKeto{db: fs.db})

	cases := []struct {
		name                       string
		user, res, action, item    string
		want                       bool
	}{
		{"clearance ABAC allows secret read", "u4", "infra.secret", "read", "i_sec1", true},
		{"separation-of-duties blocks owner approval", "u2", "billing.invoice", "approve", "i_inv1", false},
		{"non-owner approval allowed", "u2", "billing.invoice", "approve", "i_inv2", true},
		{"role override beats inherited own condition", "u1", "crm.deal", "update", "i_deal2", true},
		{"own condition fails for non-owner update", "u5", "crm.account", "update", "i_acc1", false},
		{"explicit deny wins over inherited allows", "u4", "hr.payroll", "update", "i_pr1", false},
		{"default deny with no grant", "u3", "crm.deal", "delete", "i_deal1", false},
		{"multi-condition (dept+active) fails on dept", "u2", "hr.payroll", "approve", "i_pr1", false},
		{"unconditional inherited allow", "u1", "crm.account", "read", "i_acc1", true},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dec, err := eng.Decide(context.Background(), c.user, c.res, c.action, c.item)
			if err != nil {
				t.Fatalf("Decide: %v", err)
			}
			if dec.Allow != c.want {
				t.Fatalf("allow = %v, want %v (reason: %s)", dec.Allow, c.want, dec.Reason)
			}
			if len(dec.Trace) == 0 {
				t.Fatal("expected a non-empty trace")
			}
		})
	}
}
