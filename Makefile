COMPOSE := docker compose
.DEFAULT_GOAL := help

.PHONY: help up down seed snapshot restore demo reveal smoke logs ps nuke

help:  ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  make %-10s %s\n", $$1, $$2}'

up:  ## Build and start the whole stack
	$(COMPOSE) up --build -d

down:  ## Stop the stack (keeps the seeded graph)
	$(COMPOSE) down

seed:  ## Ingest the demo case ONCE (spends Groq tokens)
	$(COMPOSE) exec backend python -m app.seed

snapshot:  ## Save the seeded graph for warm starts
	bash scripts/snapshot.sh

restore:  ## Restore the seeded graph (no re-ingest)
	bash scripts/restore.sh

demo:  ## Start the stack and restore the warm graph
	$(COMPOSE) up --build -d
	@echo "waiting for postgres to be healthy ..."
	@until [ "$$($(COMPOSE) ps postgres --format '{{.Health}}')" = "healthy" ]; do sleep 2; done
	bash scripts/restore.sh

reveal:  ## Run 'The Turn' headless (before/after)
	$(COMPOSE) exec backend python scripts/reveal.py

smoke:  ## Run the stage-2 Postgres + Cognee smoke test in-container
	$(COMPOSE) exec backend python scripts/smoke_stage2.py

logs:  ## Tail backend logs
	$(COMPOSE) logs -f backend

ps:  ## Show service status
	$(COMPOSE) ps

nuke:  ## Stop and DELETE all volumes (destroys the seeded graph)
	$(COMPOSE) down -v
