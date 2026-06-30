// Package sdk is a Go client for the KAM access-control service. It is dependency-free
// (standard library only) so services that embed it — including the guard middleware —
// stay lightweight.
package sdk

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Client talks to a KAM service over HTTP.
type Client struct {
	baseURL string
	http    *http.Client
}

// Option configures a Client.
type Option func(*Client)

// WithHTTPClient overrides the underlying *http.Client.
func WithHTTPClient(h *http.Client) Option { return func(c *Client) { c.http = h } }

// New builds a client pointed at the KAM service base URL (e.g. http://localhost:8080).
func New(baseURL string, opts ...Option) *Client {
	c := &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    &http.Client{Timeout: 10 * time.Second},
	}
	for _, o := range opts {
		o(c)
	}
	return c
}

// APIError is returned for non-2xx responses.
type APIError struct {
	Status  int
	Message string
}

func (e *APIError) Error() string { return fmt.Sprintf("kam: status %d: %s", e.Status, e.Message) }

// Check evaluates an access request and returns the decision (verdict + reason + trace).
func (c *Client) Check(ctx context.Context, req CheckRequest) (*Decision, error) {
	var dec Decision
	if err := c.do(ctx, http.MethodPost, "/v1/check", req, &dec); err != nil {
		return nil, err
	}
	return &dec, nil
}

// Allowed is a convenience wrapper returning just the boolean verdict.
func (c *Client) Allowed(ctx context.Context, req CheckRequest) (bool, error) {
	dec, err := c.Check(ctx, req)
	if err != nil {
		return false, err
	}
	return dec.Allow, nil
}

// Expand returns a user's effective grants keyed by "<resourceKey>:<action>".
func (c *Client) Expand(ctx context.Context, userID string) (map[string]EffectiveGrant, error) {
	out := map[string]EffectiveGrant{}
	if err := c.do(ctx, http.MethodPost, "/v1/expand", map[string]string{"userId": userID}, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// EffectiveGrant is one resolved grant from Expand.
type EffectiveGrant struct {
	Effect    Effect `json:"effect"`
	Source    string `json:"source"`
	Inherited bool   `json:"inherited"`
	ViaRole   string `json:"viaRole"`
}

// Seed loads the prototype seed configuration into the service.
func (c *Client) Seed(ctx context.Context) error {
	return c.do(ctx, http.MethodPost, "/v1/seed", nil, nil)
}

// ---- typed CRUD ----

func (c *Client) ListResourceTypes(ctx context.Context) ([]ResourceType, error) {
	var out []ResourceType
	return out, c.do(ctx, http.MethodGet, "/v1/resource-types/", nil, &out)
}
func (c *Client) PutResourceType(ctx context.Context, v ResourceType) (*ResourceType, error) {
	var out ResourceType
	return &out, c.do(ctx, http.MethodPut, "/v1/resource-types/", v, &out)
}
func (c *Client) DeleteResourceType(ctx context.Context, key string) error {
	return c.do(ctx, http.MethodDelete, "/v1/resource-types/"+key, nil, nil)
}

func (c *Client) ListItems(ctx context.Context) ([]Item, error) {
	var out []Item
	return out, c.do(ctx, http.MethodGet, "/v1/items/", nil, &out)
}
func (c *Client) PutItem(ctx context.Context, v Item) (*Item, error) {
	var out Item
	return &out, c.do(ctx, http.MethodPut, "/v1/items/", v, &out)
}
func (c *Client) DeleteItem(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodDelete, "/v1/items/"+id, nil, nil)
}

func (c *Client) ListConditions(ctx context.Context) ([]Condition, error) {
	var out []Condition
	return out, c.do(ctx, http.MethodGet, "/v1/conditions/", nil, &out)
}
func (c *Client) PutCondition(ctx context.Context, v Condition) (*Condition, error) {
	var out Condition
	return &out, c.do(ctx, http.MethodPut, "/v1/conditions/", v, &out)
}
func (c *Client) DeleteCondition(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodDelete, "/v1/conditions/"+id, nil, nil)
}

func (c *Client) ListRoles(ctx context.Context) ([]Role, error) {
	var out []Role
	return out, c.do(ctx, http.MethodGet, "/v1/roles/", nil, &out)
}
func (c *Client) PutRole(ctx context.Context, v Role) (*Role, error) {
	var out Role
	return &out, c.do(ctx, http.MethodPut, "/v1/roles/", v, &out)
}
func (c *Client) DeleteRole(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodDelete, "/v1/roles/"+id, nil, nil)
}

func (c *Client) ListUsers(ctx context.Context) ([]User, error) {
	var out []User
	return out, c.do(ctx, http.MethodGet, "/v1/users/", nil, &out)
}
func (c *Client) PutUser(ctx context.Context, v User) (*User, error) {
	var out User
	return &out, c.do(ctx, http.MethodPut, "/v1/users/", v, &out)
}
func (c *Client) DeleteUser(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodDelete, "/v1/users/"+id, nil, nil)
}

// Health reports whether the service is reachable and healthy.
func (c *Client) Health(ctx context.Context) error {
	return c.do(ctx, http.MethodGet, "/healthz", nil, nil)
}

func (c *Client) do(ctx context.Context, method, path string, body, out any) error {
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, rdr)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
		return &APIError{Status: resp.StatusCode, Message: strings.TrimSpace(string(msg))}
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
