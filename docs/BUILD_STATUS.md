# Build Status and Implementation Ledger

## Current Status Overview
- Timestamp: 2026-09-30 18:21 EDT
- Phase: 1. Baseline Audit, Defect Documentation, and Environment Preparation
- Verification Status: Clean baseline tests passing, TypeScript check TS2339 fixed with exact types, build passing.

## Baseline Audit and Recorded Pre-Existing Defects
1. **Model Service Hallucination / Mock Drift**: `server/services/openai.ts` returned hardcoded contract and resume findings when `OPENAI_API_KEY` was missing or upon provider errors. The mock findings contained text completely absent from analyzed inputs. Captured in `tests/baseline/preexisting_defects.test.ts`.
2. **Missing Text Persistence**: `server/routes.ts` extracted text via `extractTextFromFile` but invoked `storage.updateDocumentStatus` without writing `extractedText` into the database record. The document viewer consequently lacked text evidence.
3. **Property Mismatch in Contract Viewer**: `client/src/components/contract-viewer.tsx` expected `clause.text`, `clause.content`, or `clause.clauseText`, but database schema persisted `itemText`.
4. **Strict TypeScript Errors**: Five TS2339 property access errors in `client/src/pages/profile-settings.tsx` due to untyped `useQuery` resolution. Resolved by binding `useQuery<Profile>` to the typed schema.
5. **Lack of Durable Task Queue**: Document processing was launched asynchronously inside the HTTP handler process with no leasing, retry control, or fencing tokens. Session management utilized in-memory state.

## Local Environment Verification
- Node.js runtime: v24.21.0
- Package manager: npm 11.19.0
- Database: PostgreSQL 17.11 with pgvector 0.8.6 extension active on databases `covenant` and `covenant_test`
- OCR runtime: Tesseract OCR (`/opt/homebrew/bin/tesseract`) and `pdftoppm` verified
- Local LLM engine: llama.cpp 0.5.0 (`llama-server`, `llama-cli`) installed and operational
- Test runner: Vitest 2.1.9 with root configuration in `vitest.config.ts`

## Actual Commands and Results
- `npm run check`: Exited with code 0 (all TypeScript checks pass).
- `npm run build`: Exited with code 0 (Vite client bundle and server bundle built).
- `npx vitest run tests/baseline/preexisting_defects.test.ts`: 5 passing tests capturing pre-existing defects.

## Evidence Paths
- Baseline tests: `tests/baseline/preexisting_defects.test.ts`
- Vitest config: `vitest.config.ts`
- Status ledger: `docs/BUILD_STATUS.md`

## Next Actions
1. Commit the baseline defect suite, environment fixes, and status documentation.
2. Implement Phase 2: Document IR, canonical text offsets, source mapping, and content-addressed blob storage (`packages/document-ir`, `packages/persistence`, `packages/ingestion`).
