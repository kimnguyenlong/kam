// Package httpapi exposes the KAM service over HTTP (net/http + go-chi). The service
// performs no authentication — callers pass an already-authenticated subject id.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"gorm.io/gorm"

	"github.com/kimnguyenlong/kam/internal/engine"
	"github.com/kimnguyenlong/kam/internal/keto"
	"github.com/kimnguyenlong/kam/internal/model"
	"github.com/kimnguyenlong/kam/internal/seed"
	"github.com/kimnguyenlong/kam/internal/store"
)

// API wires the store, Keto sync, and decision engine into an http.Handler.
type API struct {
	store  *store.Store
	keto   *keto.Client
	engine *engine.Engine
}

// New builds the API.
func New(s *store.Store, k *keto.Client, e *engine.Engine) *API {
	return &API{store: s, keto: k, engine: e}
}

// Handler returns the configured router.
func (a *API) Handler() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, 200, map[string]string{"status": "ok"}) })

	r.Route("/v1", func(r chi.Router) {
		r.Post("/seed", a.handleSeed)
		r.Post("/check", a.handleCheck)
		r.Post("/expand", a.handleExpand)

		crud[model.ResourceType](r, a, "/resource-types", "key")
		crud[model.Item](r, a, "/items", "id")
		crud[model.Condition](r, a, "/conditions", "id")
		crud[model.Role](r, a, "/roles", "id")
		crud[model.User](r, a, "/users", "id")
	})
	return r
}

// ---- decision endpoints ----

type checkRequest struct {
	UserID       string `json:"userId"`
	ResourceType string `json:"resourceType"`
	Action       string `json:"action"`
	ItemID       string `json:"itemId"`
}

func (a *API) handleCheck(w http.ResponseWriter, r *http.Request) {
	var req checkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	dec, err := a.engine.Decide(r.Context(), req.UserID, req.ResourceType, req.Action, req.ItemID)
	if err != nil {
		if errors.Is(err, engine.ErrNotFound) {
			writeErr(w, http.StatusNotFound, err)
			return
		}
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, dec)
}

type expandRequest struct {
	UserID string `json:"userId"`
}

func (a *API) handleExpand(w http.ResponseWriter, r *http.Request) {
	var req expandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	grants, err := a.engine.ExpandUser(r.Context(), req.UserID)
	if err != nil {
		if errors.Is(err, engine.ErrNotFound) {
			writeErr(w, http.StatusNotFound, err)
			return
		}
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	// Flatten to a wire-friendly shape: key -> {effect, source, inherited, viaRole}.
	out := make(map[string]any, len(grants))
	for k, g := range grants {
		out[k] = map[string]any{
			"effect":    g.Effect,
			"source":    g.Source,
			"inherited": g.Inherited,
			"viaRole":   g.ViaRole,
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) handleSeed(w http.ResponseWriter, r *http.Request) {
	if err := a.store.ReplaceAll(r.Context(), seed.DB()); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if err := a.sync(r.Context()); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "seeded"})
}

// sync rebuilds Keto relation tuples from the current Postgres snapshot.
func (a *API) sync(ctx context.Context) error {
	snap, err := a.store.Snapshot(ctx)
	if err != nil {
		return err
	}
	return a.keto.SyncAll(ctx, snap)
}

// ---- generic CRUD ----

// crud mounts list/get/create-or-update/delete for an entity at base. idParam is the
// primary-key column ("id" or "key"); mutations trigger a Keto resync.
func crud[T any](r chi.Router, a *API, base, idCol string) {
	r.Route(base, func(r chi.Router) {
		r.Get("/", func(w http.ResponseWriter, req *http.Request) {
			var list []T
			if err := a.store.List(req.Context(), &list); err != nil {
				writeErr(w, http.StatusInternalServerError, err)
				return
			}
			writeJSON(w, http.StatusOK, list)
		})
		r.Put("/", func(w http.ResponseWriter, req *http.Request) {
			var v T
			if err := json.NewDecoder(req.Body).Decode(&v); err != nil {
				writeErr(w, http.StatusBadRequest, err)
				return
			}
			if err := a.store.Upsert(req.Context(), &v); err != nil {
				writeErr(w, http.StatusInternalServerError, err)
				return
			}
			if err := a.sync(req.Context()); err != nil {
				writeErr(w, http.StatusInternalServerError, err)
				return
			}
			writeJSON(w, http.StatusOK, v)
		})
		r.Get("/{id}", func(w http.ResponseWriter, req *http.Request) {
			var v T
			if err := a.store.Get(req.Context(), &v, chi.URLParam(req, "id")); err != nil {
				writeGetErr(w, err)
				return
			}
			writeJSON(w, http.StatusOK, v)
		})
		r.Delete("/{id}", func(w http.ResponseWriter, req *http.Request) {
			var v T
			if err := a.store.Delete(req.Context(), &v, idCol, chi.URLParam(req, "id")); err != nil {
				writeErr(w, http.StatusInternalServerError, err)
				return
			}
			if err := a.sync(req.Context()); err != nil {
				writeErr(w, http.StatusInternalServerError, err)
				return
			}
			w.WriteHeader(http.StatusNoContent)
		})
	})
}

// ---- helpers ----

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func writeGetErr(w http.ResponseWriter, err error) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	writeErr(w, http.StatusInternalServerError, err)
}
