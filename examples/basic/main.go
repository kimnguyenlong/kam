// Command basic demonstrates the KAM SDK: seed the service, then run a handful of access
// checks reproducing scenarios from the prototype and print the decision trace.
//
// Prereqs: the KAM stack is running (docker compose up). Then:
//
//	go run ./examples/basic
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/kimnguyenlong/kam/pkg/sdk"
)

func main() {
	base := os.Getenv("KAM_URL")
	if base == "" {
		base = "http://localhost:8080"
	}
	client := sdk.New(base)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := client.Seed(ctx); err != nil {
		log.Fatalf("seed: %v", err)
	}
	fmt.Print("seeded service with prototype data\n\n")

	type scenario struct {
		desc string
		req  sdk.CheckRequest
		want bool
	}
	scenarios := []scenario{
		{"SRE reads a secret, clearance 5 ≥ sensitivity 5 (ABAC clearance)",
			sdk.CheckRequest{UserID: "u4", ResourceType: "infra.secret", Action: "read", ItemID: "i_sec1"}, true},
		{"Controller approves an invoice he OWNS — separation of duties blocks it",
			sdk.CheckRequest{UserID: "u2", ResourceType: "billing.invoice", Action: "approve", ItemID: "i_inv1"}, false},
		{"Controller approves an invoice he does NOT own — allowed",
			sdk.CheckRequest{UserID: "u2", ResourceType: "billing.invoice", Action: "approve", ItemID: "i_inv2"}, true},
		{"Sales manager updates a deal he does NOT own — base 'own' fails but role grants allow",
			sdk.CheckRequest{UserID: "u1", ResourceType: "crm.deal", Action: "update", ItemID: "i_deal2"}, true},
		{"Sales rep updates an account he does NOT own — 'own' condition fails",
			sdk.CheckRequest{UserID: "u5", ResourceType: "crm.account", Action: "update", ItemID: "i_acc1"}, false},
		{"Platform admin updates payroll — explicit DENY wins",
			sdk.CheckRequest{UserID: "u4", ResourceType: "hr.payroll", Action: "update", ItemID: "i_pr1"}, false},
		{"Employee deletes a deal — no grant, default deny",
			sdk.CheckRequest{UserID: "u3", ResourceType: "crm.deal", Action: "delete", ItemID: "i_deal1"}, false},
	}

	for _, s := range scenarios {
		dec, err := client.Check(ctx, s.req)
		if err != nil {
			log.Fatalf("check (%s): %v", s.desc, err)
		}
		mark := "✅"
		if dec.Allow != s.want {
			mark = "❌ UNEXPECTED"
		}
		fmt.Printf("%s  %s\n", verdict(dec.Allow), s.desc)
		fmt.Printf("    reason: %s  [%s]\n", dec.Reason, mark)
		for _, step := range dec.Trace {
			fmt.Printf("      · (%s) %s — %s\n", step.Kind, step.Title, step.Detail)
		}
		fmt.Println()
	}

	// Show effective permissions for a user.
	grants, err := client.Expand(ctx, "u4")
	if err != nil {
		log.Fatalf("expand: %v", err)
	}
	fmt.Println("effective grants for u4 (Dmitri / SRE + Platform Admin):")
	for key, g := range grants {
		fmt.Printf("    %-26s via %-18s inherited=%v\n", key, g.ViaRole, g.Inherited)
	}
}

func verdict(allow bool) string {
	if allow {
		return "ALLOW"
	}
	return "DENY "
}
