// Command server runs the KAM access-control service.
package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/kimnguyenlong/kam/internal/config"
	"github.com/kimnguyenlong/kam/internal/engine"
	"github.com/kimnguyenlong/kam/internal/httpapi"
	"github.com/kimnguyenlong/kam/internal/keto"
	"github.com/kimnguyenlong/kam/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("kam: load config: %v", err)
	}

	st, err := openStoreWithRetry(cfg.DatabaseURL, 30, 2*time.Second)
	if err != nil {
		log.Fatalf("kam: connect postgres: %v", err)
	}

	kt, err := keto.New(cfg.KetoReadURL, cfg.KetoWriteURL)
	if err != nil {
		log.Fatalf("kam: connect keto: %v", err)
	}
	defer kt.Close()
	eng := engine.New(st, kt)
	api := httpapi.New(st, kt, eng)

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           api.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("kam: listening on %s (keto read=%s write=%s)", cfg.HTTPAddr, cfg.KetoReadURL, cfg.KetoWriteURL)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("kam: server: %v", err)
	}
}

// openStoreWithRetry waits for Postgres to become available (compose start ordering).
func openStoreWithRetry(dsn string, attempts int, delay time.Duration) (*store.Store, error) {
	var err error
	for i := 0; i < attempts; i++ {
		var st *store.Store
		st, err = store.Open(dsn)
		if err == nil {
			return st, nil
		}
		log.Printf("kam: waiting for postgres (%d/%d): %v", i+1, attempts, err)
		select {
		case <-time.After(delay):
		case <-context.Background().Done():
		}
	}
	return nil, err
}
