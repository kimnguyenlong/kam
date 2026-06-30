// Package middleware provides drop-in net/http middleware that guards a downstream
// service's endpoints with KAM access decisions. The host service is responsible for
// authentication; this middleware only enforces authorization.
package middleware

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/kimnguyenlong/kam/pkg/sdk"
)

// Resolver extracts a value (subject id, resource type, action, or item id) from the
// incoming request. Returning "" for the subject id yields 401; everything else may be "".
type Resolver func(*http.Request) string

// Config configures a Guard.
type Config struct {
	// Client is the KAM SDK client used to evaluate decisions. Required.
	Client *sdk.Client

	// Subject resolves the authenticated subject id. Defaults to the X-Subject-ID header.
	Subject Resolver
	// ResourceType resolves the resource type key for the request. Required (or set per route).
	ResourceType Resolver
	// Action resolves the action. Defaults to mapping the HTTP method (GET->read, POST->create,
	// PUT/PATCH->update, DELETE->delete).
	Action Resolver
	// Item resolves the optional resource item id. Defaults to no item.
	Item Resolver

	// OnDeny renders the response when access is denied. Defaults to a 403 JSON body.
	OnDeny func(w http.ResponseWriter, r *http.Request, dec *sdk.Decision)
	// OnError renders the response when the check itself fails. Defaults to a 500 JSON body.
	OnError func(w http.ResponseWriter, r *http.Request, err error)
}

type ctxKey int

const decisionKey ctxKey = 0

// DecisionFrom returns the KAM decision stored on the request context by Guard, if any.
func DecisionFrom(ctx context.Context) (*sdk.Decision, bool) {
	d, ok := ctx.Value(decisionKey).(*sdk.Decision)
	return d, ok
}

// Guard returns middleware that checks each request against KAM and blocks denied access.
func Guard(cfg Config) func(http.Handler) http.Handler {
	if cfg.Client == nil {
		panic("middleware: Config.Client is required")
	}
	if cfg.Subject == nil {
		cfg.Subject = HeaderSubject("X-Subject-ID")
	}
	if cfg.Action == nil {
		cfg.Action = MethodAction()
	}
	if cfg.OnDeny == nil {
		cfg.OnDeny = defaultOnDeny
	}
	if cfg.OnError == nil {
		cfg.OnError = defaultOnError
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			subject := cfg.Subject(r)
			if subject == "" {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing subject"})
				return
			}
			req := sdk.CheckRequest{
				UserID:       subject,
				ResourceType: resolve(cfg.ResourceType, r),
				Action:       cfg.Action(r),
				ItemID:       resolve(cfg.Item, r),
			}
			dec, err := cfg.Client.Check(r.Context(), req)
			if err != nil {
				cfg.OnError(w, r, err)
				return
			}
			if !dec.Allow {
				cfg.OnDeny(w, r, dec)
				return
			}
			ctx := context.WithValue(r.Context(), decisionKey, dec)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequirePermission is a convenience builder guarding a route with a fixed resource type
// and action. Subject defaults to the X-Subject-ID header and item to none.
func RequirePermission(client *sdk.Client, resourceType, action string) func(http.Handler) http.Handler {
	return Guard(Config{
		Client:       client,
		ResourceType: Static(resourceType),
		Action:       Static(action),
	})
}

// ---- resolvers ----

// Static returns a Resolver that always yields v.
func Static(v string) Resolver { return func(*http.Request) string { return v } }

// HeaderSubject resolves the subject id from a request header.
func HeaderSubject(header string) Resolver {
	return func(r *http.Request) string { return r.Header.Get(header) }
}

// HeaderValue resolves any value from a request header.
func HeaderValue(header string) Resolver {
	return func(r *http.Request) string { return r.Header.Get(header) }
}

// QueryValue resolves a value from a URL query parameter.
func QueryValue(key string) Resolver {
	return func(r *http.Request) string { return r.URL.Query().Get(key) }
}

// MethodAction maps the HTTP method to a KAM action (GET->read, POST->create,
// PUT/PATCH->update, DELETE->delete, otherwise the lower-cased method).
func MethodAction() Resolver {
	return func(r *http.Request) string {
		switch r.Method {
		case http.MethodGet, http.MethodHead:
			return "read"
		case http.MethodPost:
			return "create"
		case http.MethodPut, http.MethodPatch:
			return "update"
		case http.MethodDelete:
			return "delete"
		default:
			return r.Method
		}
	}
}

func resolve(res Resolver, r *http.Request) string {
	if res == nil {
		return ""
	}
	return res(r)
}

func defaultOnDeny(w http.ResponseWriter, _ *http.Request, dec *sdk.Decision) {
	writeJSON(w, http.StatusForbidden, map[string]string{"error": "access denied", "reason": dec.Reason})
}

func defaultOnError(w http.ResponseWriter, _ *http.Request, err error) {
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
