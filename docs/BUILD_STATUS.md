# Build Status and Implementation Ledger

## Current Status Overview
- Timestamp: 2026-09-30 18:26 EDT
- Phase: 2. Document Representation, Ingestion, Canonical Offsets, and Blob Storage
- Verification Status: 23 tests passing across 4 test suites; strict TypeScript check passing with zero errors; build passing.

## Implemented Modules and Capabilities
1. **DocumentIR Architecture (`packages/document-ir`)**:
   - Versioned DocumentIR schema adhering to half-open UTF-16 code unit offset slicing (`[canonicalStart, canonicalEnd)`).
   - Reversible SourceMap structure linking canonical text back to page numbers, source blocks, bounding boxes, and OCR metadata.
   - Server-side quote resolution (`resolveProposedEvidence`) and citation verification (`verifyCitationAgainstDocument`) preventing unverified client/model position tampering.
   - Binary-search source map range lookup and span extraction.
   - Typed schema serialization and deserialization via Zod.
2. **Document Ingestion & Extraction (`packages/ingestion`)**:
   - Magic byte file signature detection (`%PDF-`, `PK\x03\x04`, UTF-8 text).
   - Input file bounds enforcement: size limits, empty file rejection, and encrypted PDF detection.
   - DOCX package parser with JSZip and XML DOM: heading style detection (`Heading 1-6`), list item nesting levels (`w:numPr`), and table grid extraction (`w:tbl`, `w:tr`, `w:tc`).
   - Zip bomb defense: uncompressed size ratio and entry count bounds.
   - Multi-column layout detection and column-first reading order reconstruction for PDF pages.
   - Repeated header and footer cross-page heuristic filtering.
   - Local OCR profile for scanned PDFs using `pdftoppm` and `tesseract` with TSV bounding boxes and confidence scores.
   - Unified `extractDocument` orchestrator.
3. **Content-Addressed Blob Storage (`packages/persistence`)**:
   - `IBlobStore` contract with content-addressed SHA-256 keys.
   - `LocalFsBlobStore` with 2-character prefix subdirectories, atomic write semantics, metadata persistence, and deduplication.
   - `S3BlobStoreAdapter` for S3-compatible remote storage.
4. **Reproducible Measurement**:
   - `scripts/loc_census.ts` tracking substantive non-blank, non-comment lines by module, excluding copied UI primitives and tests.

## Actual Commands and Results
- `npm run check`: Exited with code 0 (all TypeScript checks pass).
- `npm test`: Exited with code 0 (23 passing tests across 4 test suites).
- `npx tsx scripts/loc_census.ts`: Exited with code 0 (4,470 substantive production lines, 376 test lines).

## Evidence Paths
- Baseline tests: `tests/baseline/preexisting_defects.test.ts`
- DocumentIR tests: `tests/unit/document_ir.test.ts`
- Ingestion tests: `tests/unit/ingestion.test.ts`
- Blob store tests: `tests/unit/blob_store.test.ts`
- Source ledger: `docs/BUILD_STATUS.md`

## Next Actions
1. Commit DocumentIR, ingestion pipeline, blob storage, and tests.
2. Implement Phase 3: PostgreSQL Schema with tenant/workspace isolation, Drizzle migrations, and Durable Leased Task Queue (`FOR UPDATE SKIP LOCKED`, heartbeats, retry backoff, fencing tokens).
