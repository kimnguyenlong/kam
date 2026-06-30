// Package seed provides the prototype's seed configuration (access-control.html seed()).
package seed

import "github.com/kimnguyenlong/kam/internal/model"

func sptr(s string) *string { return &s }

// ad builds an AttrDecl (keyed, to keep `go vet` happy and the seed readable).
func ad(key string, value any) model.AttrDecl { return model.AttrDecl{Key: key, Value: value} }

// DB returns a fresh seed snapshot identical to the prototype's seed() data.
func DB() model.DB {
	return model.DB{
		Resources: []model.ResourceType{
			{Key: "billing.invoice", Name: "Invoices", Domain: "Billing",
				Actions: []string{"create", "read", "update", "delete", "list", "approve", "export"},
				Attrs: []model.AttrDecl{ad("dept", "Finance"), ad("sensitivity", 3), ad("region", "US"), ad("currency", "USD"), ad("status", "draft"), ad("amount", 0)}},
			{Key: "billing.payment", Name: "Payments", Domain: "Billing",
				Actions: []string{"read", "list", "approve", "export"},
				Attrs: []model.AttrDecl{ad("dept", "Finance"), ad("sensitivity", 4), ad("region", "US"), ad("method", "ACH"), ad("status", "pending"), ad("amount", 0)}},
			{Key: "hr.employee", Name: "Employee Records", Domain: "Human Resources",
				Actions: []string{"create", "read", "update", "delete", "list", "export"},
				Attrs: []model.AttrDecl{ad("dept", "People"), ad("sensitivity", 4), ad("region", "EU"), ad("employment", "full-time"), ad("level", "IC"), ad("pii", true)}},
			{Key: "hr.payroll", Name: "Payroll", Domain: "Human Resources",
				Actions: []string{"read", "update", "approve", "export"},
				Attrs: []model.AttrDecl{ad("dept", "People"), ad("sensitivity", 5), ad("region", "EU"), ad("period", "monthly"), ad("status", "draft")}},
			{Key: "crm.account", Name: "Customer Accounts", Domain: "CRM",
				Actions: []string{"create", "read", "update", "delete", "list", "share"},
				Attrs: []model.AttrDecl{ad("dept", "Sales"), ad("sensitivity", 2), ad("region", "US"), ad("tier", "standard"), ad("industry", "technology"), ad("status", "active")}},
			{Key: "crm.deal", Name: "Deals", Domain: "CRM",
				Actions: []string{"create", "read", "update", "delete", "list", "approve"},
				Attrs: []model.AttrDecl{ad("dept", "Sales"), ad("sensitivity", 3), ad("region", "US"), ad("stage", "open"), ad("value", 0), ad("probability", 50)}},
			{Key: "infra.cluster", Name: "Compute Clusters", Domain: "Infrastructure",
				Actions: []string{"read", "update", "delete", "admin"},
				Attrs: []model.AttrDecl{ad("dept", "Platform"), ad("sensitivity", 4), ad("region", "US"), ad("env", "prod"), ad("tier", "critical"), ad("team", "core")}},
			{Key: "infra.secret", Name: "Secrets Vault", Domain: "Infrastructure",
				Actions: []string{"read", "update", "admin"},
				Attrs: []model.AttrDecl{ad("dept", "Platform"), ad("sensitivity", 5), ad("region", "US"), ad("kind", "credential"), ad("rotationDays", 90)}},
			{Key: "audit.log", Name: "Audit Logs", Domain: "Governance",
				Actions: []string{"read", "list", "export"},
				Attrs: []model.AttrDecl{ad("dept", "Platform"), ad("sensitivity", 4), ad("region", "US"), ad("retentionDays", 365), ad("immutable", true)}},
		},
		Items: []model.Item{
			{ID: "i_inv1", Name: "INV-1001 · Acme Corp", Type: "billing.invoice", Owner: "u2", Attrs: map[string]any{"sensitivity": 2, "region": "US", "currency": "USD", "status": "approved", "amount": 12500}},
			{ID: "i_inv2", Name: "INV-1002 · Globex", Type: "billing.invoice", Owner: "u1", Attrs: map[string]any{"sensitivity": 5, "region": "EU", "currency": "EUR", "status": "pending", "amount": 98000}},
			{ID: "i_pay1", Name: "PAY-5001 · Acme Corp", Type: "billing.payment", Owner: "u2", Attrs: map[string]any{"sensitivity": 4, "method": "WIRE", "status": "settled", "amount": 12500}},
			{ID: "i_emp1", Name: "Employee: Alice Chen", Type: "hr.employee", Owner: "u3", Attrs: map[string]any{"sensitivity": 3, "region": "EU", "level": "manager"}},
			{ID: "i_emp2", Name: "Employee: Sam Lee", Type: "hr.employee", Owner: "u3", Attrs: map[string]any{"sensitivity": 4, "region": "US", "employment": "contractor"}},
			{ID: "i_pr1", Name: "Payroll Run 2026-06", Type: "hr.payroll", Owner: "u3", Attrs: map[string]any{"sensitivity": 5, "period": "monthly", "status": "finalized"}},
			{ID: "i_acc1", Name: "Account: Acme Corp", Type: "crm.account", Owner: "u1", Attrs: map[string]any{"tier": "enterprise", "region": "US", "industry": "manufacturing"}},
			{ID: "i_acc2", Name: "Account: Globex", Type: "crm.account", Owner: "u5", Attrs: map[string]any{"tier": "standard", "region": "EU", "status": "churned"}},
			{ID: "i_deal1", Name: "Deal: Acme Renewal", Type: "crm.deal", Owner: "u1", Attrs: map[string]any{"sensitivity": 3, "stage": "negotiation", "value": 250000, "probability": 75}},
			{ID: "i_deal2", Name: "Deal: Globex Expansion", Type: "crm.deal", Owner: "u5", Attrs: map[string]any{"sensitivity": 4, "stage": "open", "value": 80000, "probability": 30}},
			{ID: "i_clu1", Name: "prod-cluster-1", Type: "infra.cluster", Owner: "u4", Attrs: map[string]any{"env": "prod", "region": "US", "tier": "critical", "team": "core"}},
			{ID: "i_sec1", Name: "db-credentials", Type: "infra.secret", Owner: "u4", Attrs: map[string]any{"sensitivity": 5, "region": "US", "kind": "credential", "rotationDays": 30}},
			{ID: "i_log1", Name: "Audit Log: 2026-Q2", Type: "audit.log", Owner: "u4", Attrs: map[string]any{"sensitivity": 4, "region": "US", "retentionDays": 2555}},
		},
		Conditions: []model.Condition{
			{ID: "own", Label: "If owner", Type: nil, Left: "subject.id", Op: "eq", RightType: "attr", Right: "resource.owner"},
			{ID: "dept", Label: "Same dept", Type: sptr("crm.account"), Left: "subject.dept", Op: "eq", RightType: "attr", Right: "resource.dept"},
			{ID: "sod", Label: "Separation of duties", Type: sptr("billing.invoice"), Left: "subject.id", Op: "neq", RightType: "attr", Right: "resource.owner"},
			{ID: "clr", Label: "Sufficient clearance", Type: sptr("infra.secret"), Left: "subject.clearance", Op: "gte", RightType: "attr", Right: "resource.sensitivity"},
			{ID: "active", Label: "Active employee", Type: sptr("hr.employee"), Left: "subject.status", Op: "eq", RightType: "literal", Right: "active"},
			{ID: "region", Label: "Same data region", Type: sptr("crm.account"), Left: "subject.region", Op: "eq", RightType: "attr", Right: "resource.region"},
		},
		Roles: []model.Role{
			{ID: "r_base", Name: "Employee", Desc: "Baseline access for all staff", Parent: nil,
				Grants: map[string]model.Effect{"crm.account:read": model.Allow(), "crm.account:list": model.Allow(), "crm.deal:read": model.Allow(), "crm.deal:list": model.Allow(), "hr.employee:read": model.Conditional("own")}},
			{ID: "r_sales", Name: "Sales Rep", Desc: "CRM read/write on owned records", Parent: sptr("r_base"),
				Grants: map[string]model.Effect{"crm.account:create": model.Allow(), "crm.account:update": model.Conditional("own"), "crm.deal:create": model.Allow(), "crm.deal:update": model.Conditional("own"), "crm.account:share": model.Allow()}},
			{ID: "r_sales_mgr", Name: "Sales Manager", Desc: "Approves deals, full CRM", Parent: sptr("r_sales"),
				Grants: map[string]model.Effect{"crm.account:delete": model.Allow(), "crm.deal:update": model.Allow(), "crm.deal:delete": model.Allow(), "crm.deal:approve": model.Conditional("dept")}},
			{ID: "r_fin", Name: "Finance Analyst", Desc: "Billing read + export", Parent: sptr("r_base"),
				Grants: map[string]model.Effect{"billing.invoice:read": model.Allow(), "billing.invoice:list": model.Allow(), "billing.invoice:export": model.Allow(), "billing.payment:read": model.Allow(), "billing.payment:list": model.Allow()}},
			{ID: "r_fin_ctrl", Name: "Financial Controller", Desc: "Approves invoices & payroll", Parent: sptr("r_fin"),
				Grants: map[string]model.Effect{"billing.invoice:create": model.Allow(), "billing.invoice:update": model.Allow(), "billing.invoice:approve": model.Conditional("sod"), "billing.payment:approve": model.Conditional("sod"), "hr.payroll:read": model.Allow(), "hr.payroll:approve": model.Conditional("dept", "active")}},
			{ID: "r_hr", Name: "HR Specialist", Desc: "Manage employee records", Parent: sptr("r_base"),
				Grants: map[string]model.Effect{"hr.employee:create": model.Allow(), "hr.employee:update": model.Allow(), "hr.employee:list": model.Allow(), "hr.payroll:read": model.Conditional("dept")}},
			{ID: "r_sre", Name: "SRE", Desc: "Infrastructure operations", Parent: sptr("r_base"),
				Grants: map[string]model.Effect{"infra.cluster:read": model.Allow(), "infra.cluster:update": model.Allow(), "infra.secret:read": model.Conditional("clr"), "audit.log:read": model.Allow()}},
			{ID: "r_admin", Name: "Platform Admin", Desc: "Full administrative control", Parent: nil,
				Grants: map[string]model.Effect{"infra.cluster:admin": model.Allow(), "infra.cluster:delete": model.Allow(), "infra.secret:admin": model.Allow(), "infra.secret:update": model.Allow(), "audit.log:read": model.Allow(), "audit.log:export": model.Allow(), "hr.payroll:update": model.Deny()}},
		},
		Users: []model.User{
			{ID: "u1", Name: "Alice Chen", Email: "alice@acme.io", Dept: "Sales", Clearance: 3, Region: "US", Status: "active", Roles: []string{"r_sales_mgr"}},
			{ID: "u2", Name: "Bob Ortiz", Email: "bob@acme.io", Dept: "Finance", Clearance: 4, Region: "US", Status: "active", Roles: []string{"r_fin_ctrl"}},
			{ID: "u3", Name: "Priya Nair", Email: "priya@acme.io", Dept: "People", Clearance: 4, Region: "EU", Status: "active", Roles: []string{"r_hr"}},
			{ID: "u4", Name: "Dmitri Volkov", Email: "dmitri@acme.io", Dept: "Platform", Clearance: 5, Region: "US", Status: "active", Roles: []string{"r_sre", "r_admin"}},
			{ID: "u5", Name: "Sam Lee", Email: "sam@acme.io", Dept: "Sales", Clearance: 2, Region: "US", Status: "suspended", Roles: []string{"r_sales"}},
		},
	}
}
