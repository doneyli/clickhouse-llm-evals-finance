# Deployment Gates for LLMs & AI Agents — one-command workflow.
#
# Quick path for a fresh clone:
#   make install        # install Python deps
#   make preflight      # verify credentials + Langfuse connectivity (go/no-go)
#   make seed           # load sample data + register score configs, queues, prompts
#   make gate           # run the model deployment gate (PASS/FAIL)
#   make portal         # build + launch the Certification Portal on :8050
#
# Or the whole non-interactive setup at once (stops before the long-running portal):
#   make quickstart
#
# Overridable variables (defaults shown):
#   MODEL=claude-sonnet-4-6  DATASET=certification/financebench-sample  USE_CASE=10k-analyst
#   PY="uv run python"       # pip users: make PY=python ...
#
# Credentials are NOT created by any target — they are a human step. See AGENTS.md.

PY      ?= uv run python
PYTEST  ?= uv run pytest
MODEL   ?= claude-sonnet-4-6
DATASET ?= certification/financebench-sample
USE_CASE ?= 10k-analyst
COMPOSE := docker compose -f selfhost/docker-compose.yml

.DEFAULT_GOAL := help
.PHONY: help install preflight seed gate agent-gate demo export portal test up down quickstart

help: ## Show this help
	@echo "Deployment Gates — make targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Vars: MODEL=$(MODEL)  DATASET=$(DATASET)  USE_CASE=$(USE_CASE)"

install: ## Install Python dependencies (uv sync)
	uv sync

preflight: ## Verify env, credentials, and Langfuse connectivity (go/no-go)
	$(PY) scripts/preflight.py

seed: preflight ## Load sample dataset + register score configs, queues, prompts (correct order)
	$(PY) setup_datasets.py --dataset financebench --sample
	$(PY) setup_score_configs.py
	$(PY) setup_annotation_queues.py
	$(PY) setup_prompts.py
	@echo "Seed complete. Next: make gate  (or  make agent-gate)"

gate: ## Run the model deployment gate (MODEL, DATASET overridable)
	$(PY) run_certification.py --dataset $(DATASET) --model $(MODEL) --queue-failures

agent-gate: ## Run the multi-dimensional agent gate (USE_CASE, DATASET overridable)
	$(PY) run_usecase_certification.py --use-case $(USE_CASE) --dataset $(DATASET) --queue-failures

demo: ## Full-lifecycle demo for one agent (scripts/demo_usecase.sh)
	bash scripts/demo_usecase.sh

export: ## Export the evidence pack for the latest run (markdown)
	$(PY) export_results.py --dataset $(DATASET)

portal/frontend/dist/index.html: portal/frontend/package.json
	cd portal/frontend && npm install && npm run build

portal: portal/frontend/dist/index.html ## Build (once) + launch the Certification Portal on :8050
	$(PY) -m portal.app

test: ## Run the offline test suite (no credentials needed)
	$(PYTEST) --ignore=tests/test_certification.py -q

up: ## Start the self-hosted Langfuse stack (Docker Compose)
	$(COMPOSE) up -d
	@echo "Langfuse starting at http://localhost:3000 — create an Org+Project and API keys, then fill .env"

down: ## Stop the self-hosted Langfuse stack
	$(COMPOSE) down

quickstart: install preflight seed gate ## install -> preflight -> seed -> one gate run (stops before portal)
	@echo ""
	@echo "Setup done. Launch the dashboard with:  make portal   (then open http://localhost:8050)"
