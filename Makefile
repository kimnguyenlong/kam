# KAM dev convenience targets.
#
# Dev stack = base compose + dev override (hot reload for the Go service and
# the Next.js frontend). Override the file set with COMPOSE if needed.

COMPOSE ?= docker compose -f docker-compose.yml -f docker-compose.dev.yml

.PHONY: up down restart

up: ## Build and start the dev stack (hot reload) in the background
	$(COMPOSE) up --build -d

down: ## Stop and remove the dev stack containers
	$(COMPOSE) down

restart: down up ## Restart the dev stack
