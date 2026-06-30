// Command middleware demonstrates guarding a downstream service's HTTP API with KAM.
//
// It stands up a tiny "billing" service whose /invoices endpoints are wrapped with
// middleware.Guard. The middleware reads the subject from X-Subject-ID, maps the HTTP
// method to a KAM action, and calls the KAM service to authorize each request.
//
// Prereqs: the KAM stack is running and seeded (see examples/basic). Then:
//
//	go run ./examples/middleware
//	# allowed: finance controller may read invoices
//	curl -s -H 'X-Subject-ID: u2' localhost:9090/invoices
//	# denied: HR specialist has no billing grant
//	curl -s -H 'X-Subject-ID: u3' localhost:9090/invoices
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/kimnguyenlong/kam/pkg/middleware"
	"github.com/kimnguyenlong/kam/pkg/sdk"
)

func main() {
	base := os.Getenv("KAM_URL")
	if base == "" {
		base = "http://localhost:8080"
	}
	client := sdk.New(base)

	// Guard the billing routes: subject from X-Subject-ID header (set by the host's auth
	// layer), resource type fixed to billing.invoice, action derived from the HTTP method.
	guard := middleware.Guard(middleware.Config{
		Client:       client,
		ResourceType: middleware.Static("billing.invoice"),
		// Action defaults to MethodAction(): GET->read, POST->create, etc.
		// Optionally resolve a specific item from a header for per-item ABAC checks:
		Item: middleware.HeaderValue("X-Invoice-ID"),
	})

	mux := http.NewServeMux()
	billing := http.NewServeMux()
	billing.HandleFunc("/invoices", func(w http.ResponseWriter, r *http.Request) {
		dec, _ := middleware.DecisionFrom(r.Context())
		fmt.Fprintf(w, "ok: %s allowed on billing.invoice (%s)\n", r.Header.Get("X-Subject-ID"), dec.Reason)
	})
	mux.Handle("/invoices", guard(billing))

	addr := ":9090"
	log.Printf("billing service (guarded by KAM at %s) listening on %s", base, addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
