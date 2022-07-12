# Build Status and Implementation Ledger

## Current Status Overview
- Timestamp: 2026-09-30 18:37 EDT
- Phase: 6. Contract Intelligence Pipeline (Clause Segmentation, Entity/Obligation Extraction, Version Comparison, Review Pipeline)
- Verification Status: 45 tests passing across 8 test suites; strict TypeScript check passing with zero errors; build passing.

## Implemented Modules and Capabilities
1. **Clause Segmenter (`packages/contract-pipeline/src/clause_segmenter.ts`)**:
   - Reconstructs hierarchical contract clause tree from DocumentIR blocks.
   - Detects numbered sections (articles, sections, subsections like 1.1, schedules, exhibits) and preamble blocks.
   - Computes parent-child relations, heading text, depth levels, and exact canonical offsets.
   - Categorizes clauses into standard contract archetypes (confidentiality, IP assignment, indemnification, liability limitation, termination, governing law, non-compete, etc.).
2. **Entity Extractor (`packages/contract-pipeline/src/entity_extractor.ts`)**:
   - Extracts contracting parties with alias resolution and role inference (primary entity vs counterparty, disclosing vs receiving).
   - Extracts defined terms and definitions from definition clauses.
   - Extracts numeric quantities with normalized units: notice periods (calendar/business days), non-compete durations (months), liability caps (USD), and payment net days.
   - Extracts governing law and jurisdiction clauses.
3. **Obligation Extractor (`packages/contract-pipeline/src/obligation_extractor.ts`)**:
   - Identifies contractual modal verbs (`shall`, `must`, `will`, `may`, `shall not`, `must not`).
   - Extracts obligation actors, actions, conditions, and exceptions (e.g. carve-outs for gross negligence or willful misconduct).
   - Evaluates bilateral vs unilateral symmetry.
   - Maps extracted obligations to `ExtractedClauseEntity` records for policy evaluation.
4. **Version Comparator (`packages/contract-pipeline/src/version_comparator.ts`)**:
   - Performs multi-pass alignment between contract revisions: exact section number matches, content similarity via Dice coefficient, and moved/renumbered clauses.
   - Computes token-level Myers/LCS diffs identifying exact insertions, deletions, and unchanged spans.
   - Analyzes high-risk shifts: numeric threshold modifications (e.g. 30 days reduced to 14 days), modality shifts (e.g. mandatory to discretionary), added negative covenants, and added/deleted clauses.
5. **Contract Review Pipeline Orchestrator (`packages/contract-pipeline/src/pipeline.ts`)**:
   - Orchestrates segmentation, entity extraction, obligation extraction, policy evaluation, and summary generation.
   - Enforces strict verification of all finding citations against canonical document text slices.

## Actual Commands and Results
- `npm run check`: Exited with code 0 (all TypeScript checks pass).
- `DATABASE_URL="postgres://localhost:5432/covenant_test" npm test`: Exited with code 0 (45 passing tests across 8 test suites).
- `npx tsx scripts/loc_census.ts`: Exited with code 0 (8,444 substantive production lines, 1,254 test lines).

## Evidence Paths
- Baseline tests: `tests/baseline/preexisting_defects.test.ts`
- DocumentIR tests: `tests/unit/document_ir.test.ts`
- Ingestion tests: `tests/unit/ingestion.test.ts`
- Blob store tests: `tests/unit/blob_store.test.ts`
- Task queue integration tests: `tests/integration/task_queue.test.ts`
- Retrieval unit tests: `tests/unit/retrieval.test.ts`
- Policy unit tests: `tests/unit/policies.test.ts`
- Contract pipeline tests: `tests/unit/contract_pipeline.test.ts`
- Source ledger: `docs/BUILD_STATUS.md`

## Next Actions
1. Commit Phase 6: Contract Intelligence Pipeline.
2. Implement Phase 7: Resume Intelligence Pipeline (`packages/resume-pipeline`) with candidate profile extraction, role requirement parsing, hybrid requirement coverage matrix, ATS heuristic checks, and strict factual preservation rewrite validator.
