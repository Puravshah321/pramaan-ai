# Pramaan AI — Automation & Workflow Makefile
.PHONY: help setup dev demo test lint build docker-up docker-down

help:
	@echo "Pramaan AI — Development commands:"
	@echo "  make setup      - Install backend and frontend dependencies"
	@echo "  make dev        - Run backend API and frontend dev server"
	@echo "  make demo       - Start Pramaan AI in DEMO mode (simulated data)"
	@echo "  make test       - Run backend unit/integration tests & frontend build"
	@echo "  make lint       - Run Ruff linter and TypeScript compiler check"
	@echo "  make docker-up  - Start full stack in Docker Compose"

setup:
	@echo "Setting up Python virtual environment..."
	cd backend && python -m venv .venv && .venv/Scripts/pip install -e .[dev]
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

dev:
	@echo "Starting Pramaan AI Backend & Frontend..."
	cd backend && .venv/Scripts/uvicorn app.main:app --reload --port 8000 &
	cd frontend && npm run dev

demo:
	@echo "Starting Pramaan AI in DEMO mode..."
	set DEMO=1 && cd backend && .venv/Scripts/uvicorn app.main:app --reload --port 8000 &
	cd frontend && npm run dev

test:
	@echo "Running backend test suite with coverage..."
	cd backend && .venv/Scripts/pytest -v
	@echo "Testing frontend production build..."
	cd frontend && npm run build

lint:
	@echo "Checking backend with Ruff..."
	cd backend && .venv/Scripts/ruff check app tests
	@echo "Checking frontend types with TypeScript..."
	cd frontend && npm run build

docker-up:
	docker compose up --build

docker-down:
	docker compose down
