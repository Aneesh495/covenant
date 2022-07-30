.PHONY: all bootstrap dev dev-api dev-worker demo test test-unit test-integration test-e2e eval benchmark acceptance verify loc check clean help

SHELL := /bin/bash
DATABASE_URL ?= postgres://localhost:5432/covenant
TEST_DATABASE_URL ?= postgres://localhost:5432/covenant_test

all: verify

help:
	@echo "Covenant Document Intelligence Workbench"
	@echo ""
	@echo "Targets:"
	@echo "  bootstrap        Install dependencies and run database migrations"
	@echo "  dev              Start dev API server, worker, and Vite client concurrently"
	@echo "  demo             Seed realistic contracts and resumes, then launch dev server"
	@echo "  test             Run all unit test suites"
	@echo "  test-integration Run PostgreSQL and task queue integration tests"
	@echo "  test-e2e         Run API and worker end-to-end integration tests"
	@echo "  eval             Run contract and resume benchmark evaluations"
	@echo "  benchmark        Run worker crash recovery benchmark (105 failure injections)"
	@echo "  acceptance       Run complete acceptance suite and write ACCEPTANCE.json"
	@echo "  verify           Execute typecheck, test suites, acceptance gates, and LOC census"
	@echo "  loc              Run substantive production LOC census"
	@echo "  check            Run strict TypeScript compilation check"
	@echo "  clean            Remove build outputs and temporary test artifacts"

bootstrap:
	npm install
	DATABASE_URL=$(DATABASE_URL) npx tsx packages/persistence/src/migrate.ts

dev:
	@echo "Starting Covenant API, background worker, and Vite client..."
	npx concurrently -k -n "api,worker" -c "blue,magenta" \
		"DATABASE_URL=$(DATABASE_URL) npm run dev" \
		"DATABASE_URL=$(DATABASE_URL) npm run dev:worker"

dev-api:
	DATABASE_URL=$(DATABASE_URL) npm run dev

dev-worker:
	DATABASE_URL=$(DATABASE_URL) npm run dev:worker

demo:
	DATABASE_URL=$(DATABASE_URL) npx tsx scripts/demo_seed.ts
	@echo "Demo data ready. Launching development workbench..."
	$(MAKE) dev

check:
	npm run check

test: test-unit

test-unit:
	DATABASE_URL=$(TEST_DATABASE_URL) npx vitest run tests/unit tests/baseline --fileParallelism=false

test-integration:
	DATABASE_URL=$(TEST_DATABASE_URL) npx vitest run tests/integration --fileParallelism=false

test-e2e:
	DATABASE_URL=$(TEST_DATABASE_URL) npx vitest run tests/integration/api.test.ts tests/integration/worker.test.ts --fileParallelism=false

eval:
	DATABASE_URL=$(TEST_DATABASE_URL) npx tsx packages/evaluation/src/acceptance_runner.ts

benchmark:
	DATABASE_URL=$(TEST_DATABASE_URL) npx tsx packages/evaluation/src/runners/recovery_benchmark.ts

acceptance:
	DATABASE_URL=$(TEST_DATABASE_URL) npx tsx packages/evaluation/src/acceptance_runner.ts

loc:
	npx tsx scripts/loc_census.ts

verify: check test test-integration eval benchmark loc
	@echo "All verification checks passed cleanly!"

clean:
	rm -rf dist
	rm -rf client/dist
	rm -rf data/test_blobs
	rm -rf data/test_recovery_blobs
	rm -rf data/test_api_blobs
	rm -rf data/test_worker_blobs
	rm -f ACCEPTANCE.json
