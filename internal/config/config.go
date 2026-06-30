// Package config loads service configuration from the environment.
package config

import (
	"context"
	"fmt"

	"github.com/sethvargo/go-envconfig"
)

// Config holds runtime configuration for the KAM service.
//
// Each field is populated from its `env` tag, falling back to the `default` when
// the variable is unset or empty. The defaults match the localhost ports the
// docker compose stack exposes, so the service runs with no env vars set.
type Config struct {
	// HTTPAddr is the listen address for the KAM HTTP API.
	HTTPAddr string `env:"KAM_HTTP_ADDR, default=:8080"`
	// DatabaseURL is the Postgres DSN for the main KAM database.
	DatabaseURL string `env:"KAM_DATABASE_URL, default=postgres://kam:kam@localhost:5432/kam?sslmode=disable"`
	// KetoReadURL is the gRPC target of Keto's read API (check / expand), default :4466.
	KetoReadURL string `env:"KAM_KETO_READ_URL, default=localhost:4466"`
	// KetoWriteURL is the gRPC target of Keto's write API (relation-tuples), default :4467.
	KetoWriteURL string `env:"KAM_KETO_WRITE_URL, default=localhost:4467"`
}

// Load reads configuration from the environment, applying local-friendly defaults.
func Load() (Config, error) {
	var cfg Config
	if err := envconfig.Process(context.Background(), &cfg); err != nil {
		return Config{}, fmt.Errorf("config: process env: %w", err)
	}
	return cfg, nil
}
