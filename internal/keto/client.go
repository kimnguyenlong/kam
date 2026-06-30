// Package keto is a thin gRPC client for Ory Keto's read/write/check APIs. It owns the
// RBAC layer: SyncAll rebuilds relation tuples from the Postgres snapshot, and Check /
// CheckDeny answer the base reachability questions the decision engine layers ABAC onto.
package keto

import (
	"context"
	"fmt"
	"strings"

	rts "github.com/ory/keto/proto/ory/keto/relation_tuples/v1alpha2"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/kimnguyenlong/kam/internal/model"
)

// Namespaces and relation-name helpers must match keto/opl/permissions.ts.
const (
	nsRole     = "Role"
	nsResource = "Resource"
	relMembers = "members"

	// checkMaxDepth bounds how far Keto walks subject-set indirection (role inheritance).
	checkMaxDepth = 20
)

func denyRel(action string) string { return "deny_" + action }

// Client talks to Keto's read API (check) and write API (relation tuples) over gRPC.
// Keto multiplexes gRPC and REST on the same ports, so the read/write targets are the
// same host:port pairs the REST client used (default :4466 read, :4467 write).
type Client struct {
	readConn  *grpc.ClientConn
	writeConn *grpc.ClientConn

	check CheckServiceClient
	read  ReadServiceClient
	write WriteServiceClient
}

// Aliases keep the generated package out of the rest of the file's signatures.
type (
	CheckServiceClient = rts.CheckServiceClient
	ReadServiceClient  = rts.ReadServiceClient
	WriteServiceClient = rts.WriteServiceClient
)

// New dials Keto. readTarget is Keto's read port (default :4466); writeTarget is the
// write/admin port (default :4467). Targets are gRPC dial targets (host:port); a leading
// http:// or https:// scheme is tolerated and stripped for callers still passing URLs.
func New(readTarget, writeTarget string) (*Client, error) {
	readConn, err := dial(readTarget)
	if err != nil {
		return nil, fmt.Errorf("keto dial read %q: %w", readTarget, err)
	}
	writeConn, err := dial(writeTarget)
	if err != nil {
		readConn.Close()
		return nil, fmt.Errorf("keto dial write %q: %w", writeTarget, err)
	}
	return &Client{
		readConn:  readConn,
		writeConn: writeConn,
		check:     rts.NewCheckServiceClient(readConn),
		read:      rts.NewReadServiceClient(readConn),
		write:     rts.NewWriteServiceClient(writeConn),
	}, nil
}

func dial(target string) (*grpc.ClientConn, error) {
	return grpc.NewClient(grpcTarget(target), grpc.WithTransportCredentials(insecure.NewCredentials()))
}

// grpcTarget normalizes a REST-style URL (http://host:port) to a gRPC dial target
// (host:port) so existing config/env values keep working.
func grpcTarget(s string) string {
	s = strings.TrimRight(s, "/")
	s = strings.TrimPrefix(s, "http://")
	s = strings.TrimPrefix(s, "https://")
	return s
}

// Close releases the underlying gRPC connections.
func (c *Client) Close() error {
	var err error
	if c.readConn != nil {
		err = c.readConn.Close()
	}
	if c.writeConn != nil {
		if e := c.writeConn.Close(); e != nil && err == nil {
			err = e
		}
	}
	return err
}

// Check answers whether userID reaches an (allow/conditional) grant for action on the
// resource type, following role inheritance — i.e. the OPL permit Resource:<resKey>#<action>.
func (c *Client) Check(ctx context.Context, resKey, action, userID string) (bool, error) {
	return c.checkTuple(ctx, nsResource, resKey, action, userID)
}

// CheckDeny answers whether userID reaches a deny grant for action on the resource type.
func (c *Client) CheckDeny(ctx context.Context, resKey, action, userID string) (bool, error) {
	return c.checkTuple(ctx, nsResource, resKey, denyRel(action), userID)
}

func (c *Client) checkTuple(ctx context.Context, ns, object, relation, subjectID string) (bool, error) {
	resp, err := c.check.Check(ctx, &rts.CheckRequest{
		Tuple: &rts.RelationTuple{
			Namespace: ns,
			Object:    object,
			Relation:  relation,
			Subject:   subjectID2(subjectID),
		},
		MaxDepth: checkMaxDepth,
	})
	if err != nil {
		return false, fmt.Errorf("keto check: %w", err)
	}
	return resp.GetAllowed(), nil
}

// SyncAll rebuilds the Role and Resource relation tuples from a config snapshot. It first
// clears those namespaces, then writes membership, inheritance, and per-grant tuples.
func (c *Client) SyncAll(ctx context.Context, db model.DB) error {
	if err := c.deleteNamespace(ctx, nsResource); err != nil {
		return err
	}
	if err := c.deleteNamespace(ctx, nsRole); err != nil {
		return err
	}

	var deltas []*rts.RelationTupleDelta
	insert := func(t *rts.RelationTuple) {
		deltas = append(deltas, &rts.RelationTupleDelta{Action: rts.RelationTupleDelta_ACTION_INSERT, RelationTuple: t})
	}

	// Role membership: Role:<rid>#members@User:<uid>
	for _, u := range db.Users {
		for _, rid := range u.Roles {
			insert(&rts.RelationTuple{Namespace: nsRole, Object: rid, Relation: relMembers, Subject: subjectID2(u.ID)})
		}
	}
	// Role inheritance (nested groups): Role:<parent>#members@(Role:<child>#members)
	for _, r := range db.Roles {
		if r.Parent != nil && *r.Parent != "" {
			insert(&rts.RelationTuple{
				Namespace: nsRole, Object: *r.Parent, Relation: relMembers,
				Subject: subjectSet2(nsRole, r.ID, relMembers),
			})
		}
	}
	// Grants: allow/conditional -> Resource:<key>#<action>; deny -> Resource:<key>#deny_<action>
	for _, r := range db.Roles {
		for grantKey, eff := range r.Grants {
			resKey, action, ok := SplitGrantKey(grantKey)
			if !ok {
				continue
			}
			relation := action
			if eff.Kind == model.EffectDeny {
				relation = denyRel(action)
			}
			insert(&rts.RelationTuple{
				Namespace: nsResource, Object: resKey, Relation: relation,
				Subject: subjectSet2(nsRole, r.ID, relMembers),
			})
		}
	}

	return c.transact(ctx, deltas)
}

// SplitGrantKey splits "<resourceKey>:<action>" (the resource key may contain dots).
func SplitGrantKey(k string) (resKey, action string, ok bool) {
	i := strings.LastIndex(k, ":")
	if i < 0 {
		return "", "", false
	}
	return k[:i], k[i+1:], true
}

func (c *Client) transact(ctx context.Context, deltas []*rts.RelationTupleDelta) error {
	if len(deltas) == 0 {
		return nil
	}
	_, err := c.write.TransactRelationTuples(ctx, &rts.TransactRelationTuplesRequest{RelationTupleDeltas: deltas})
	if err != nil {
		return fmt.Errorf("keto transact: %w", err)
	}
	return nil
}

func (c *Client) deleteNamespace(ctx context.Context, ns string) error {
	_, err := c.write.DeleteRelationTuples(ctx, &rts.DeleteRelationTuplesRequest{
		RelationQuery: &rts.RelationQuery{Namespace: &ns},
	})
	if err != nil {
		return fmt.Errorf("keto delete ns %s: %w", ns, err)
	}
	return nil
}

// Ping checks Keto's read endpoint is reachable (used for readiness).
func (c *Client) Ping(ctx context.Context) error {
	ns := nsRole
	_, err := c.read.ListRelationTuples(ctx, &rts.ListRelationTuplesRequest{
		RelationQuery: &rts.RelationQuery{Namespace: &ns},
	})
	if err != nil {
		return fmt.Errorf("keto ping: %w", err)
	}
	return nil
}

// subjectID2 builds a concrete-subject reference (User:<id>).
func subjectID2(id string) *rts.Subject {
	return &rts.Subject{Ref: &rts.Subject_Id{Id: id}}
}

// subjectSet2 builds a subject-set reference (all members of an object's relation).
func subjectSet2(ns, object, relation string) *rts.Subject {
	return &rts.Subject{Ref: &rts.Subject_Set{Set: &rts.SubjectSet{Namespace: ns, Object: object, Relation: relation}}}
}
