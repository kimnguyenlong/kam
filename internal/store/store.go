// Package store is the GORM-backed persistence layer. Postgres is the system of
// record; the Keto sync layer is rebuilt from this data after every mutation.
package store

import (
	"context"
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/kimnguyenlong/kam/internal/model"
)

// Store wraps a *gorm.DB with typed access to the KAM entities.
type Store struct {
	db *gorm.DB
}

// Open connects to Postgres and runs AutoMigrate for all entities.
func Open(dsn string) (*Store, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("store: open: %w", err)
	}
	if err := db.AutoMigrate(
		&model.ResourceType{}, &model.Item{}, &model.Condition{},
		&model.Role{}, &model.User{},
	); err != nil {
		return nil, fmt.Errorf("store: automigrate: %w", err)
	}
	return &Store{db: db}, nil
}

// Snapshot loads the entire configuration. Used by the Keto sync layer.
func (s *Store) Snapshot(ctx context.Context) (model.DB, error) {
	var out model.DB
	tx := s.db.WithContext(ctx)
	if err := tx.Find(&out.Resources).Error; err != nil {
		return out, err
	}
	if err := tx.Find(&out.Items).Error; err != nil {
		return out, err
	}
	if err := tx.Find(&out.Conditions).Error; err != nil {
		return out, err
	}
	if err := tx.Find(&out.Roles).Error; err != nil {
		return out, err
	}
	if err := tx.Find(&out.Users).Error; err != nil {
		return out, err
	}
	return out, nil
}

// ReplaceAll wipes every table and loads the given snapshot in one transaction.
// Used by the seed endpoint.
func (s *Store) ReplaceAll(ctx context.Context, db model.DB) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, m := range []any{&model.User{}, &model.Role{}, &model.Condition{}, &model.Item{}, &model.ResourceType{}} {
			if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(m).Error; err != nil {
				return err
			}
		}
		if err := insertAll(tx, db); err != nil {
			return err
		}
		return nil
	})
}

func insertAll(tx *gorm.DB, db model.DB) error {
	if len(db.Resources) > 0 {
		if err := tx.Create(&db.Resources).Error; err != nil {
			return err
		}
	}
	if len(db.Items) > 0 {
		if err := tx.Create(&db.Items).Error; err != nil {
			return err
		}
	}
	if len(db.Conditions) > 0 {
		if err := tx.Create(&db.Conditions).Error; err != nil {
			return err
		}
	}
	if len(db.Roles) > 0 {
		if err := tx.Create(&db.Roles).Error; err != nil {
			return err
		}
	}
	if len(db.Users) > 0 {
		if err := tx.Create(&db.Users).Error; err != nil {
			return err
		}
	}
	return nil
}

// ---- Lookups used by the decision engine ----

func (s *Store) UserByID(ctx context.Context, id string) (*model.User, error) {
	var u model.User
	if err := s.db.WithContext(ctx).First(&u, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) ResourceTypeByKey(ctx context.Context, key string) (*model.ResourceType, error) {
	var r model.ResourceType
	if err := s.db.WithContext(ctx).First(&r, "key = ?", key).Error; err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *Store) ItemByID(ctx context.Context, id string) (*model.Item, error) {
	var i model.Item
	if err := s.db.WithContext(ctx).First(&i, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &i, nil
}

func (s *Store) Roles(ctx context.Context) ([]model.Role, error) {
	var rs []model.Role
	return rs, s.db.WithContext(ctx).Find(&rs).Error
}

func (s *Store) Conditions(ctx context.Context) ([]model.Condition, error) {
	var cs []model.Condition
	return cs, s.db.WithContext(ctx).Find(&cs).Error
}

// ---- Generic CRUD helpers (used by the HTTP handlers) ----

func (s *Store) List(ctx context.Context, dst any) error {
	return s.db.WithContext(ctx).Find(dst).Error
}

func (s *Store) Get(ctx context.Context, dst any, id string) error {
	return s.db.WithContext(ctx).First(dst, "id = ?", id).Error
}

// GetByKey fetches a resource type (whose primary key column is "key").
func (s *Store) GetByKey(ctx context.Context, dst any, key string) error {
	return s.db.WithContext(ctx).First(dst, "key = ?", key).Error
}

// Upsert creates or updates a record by primary key.
func (s *Store) Upsert(ctx context.Context, v any) error {
	return s.db.WithContext(ctx).Save(v).Error
}

// Delete removes a record by id column.
func (s *Store) Delete(ctx context.Context, model any, idColumn, id string) error {
	return s.db.WithContext(ctx).Where(idColumn+" = ?", id).Delete(model).Error
}
