# ADR-001: Immutable Document Intermediate Representation (DocumentIR)

## Status
Accepted

## Context
Document processing platforms frequently suffer from coordinate drift, where character offsets computed by backend extractors fail to align with text rendered in web browsers. Furthermore, different extractors normalize line breaks, spaces, and punctuation inconsistently, leading to broken evidence citations and visual misalignment. In legal and compliance workflows, an ungrounded or misaligned citation completely undermines reviewer trust.

## Decision
We establish a canonical, content-addressed Document Intermediate Representation (`DocumentIR`) with the following strict invariants:

1. **Half-Open UTF-16 Code-Unit Offsets**:
   All string coordinates across blocks, spans, citations, and findings are indexed using half-open UTF-16 intervals: `[startOffset, endOffset)`. This guarantees exact interoperability with JavaScript's native string slicing (`String.prototype.slice(start, end)`).

2. **Immutable Snapshot Versioning**:
   Every uploaded file is hashed via SHA-256 upon arrival and stored in a content-addressed blob store. Each ingested version generates an immutable `DocumentIR` persisted as JSON in `document_versions.document_ir_json`. Subsequent reviews or revisions point to immutable historical version records.

3. **Hierarchical Block Mapping**:
   The canonical document text is composed of ordered `SourceBlock` entities (headings, paragraphs, lists, tables). Each block retains its original page number, bounding box coordinates (for PDFs), block type, and canonical code-unit offset span.

4. **Reversible Citation Verification**:
   Every citation produced by model or rule evaluation must satisfy:
   `canonicalText.slice(citation.startOffset, citation.endOffset) === citation.exactQuote`.
   Any citation failing this check is intercepted and realigned or rejected before publication.

## Consequences
- **Positive**: Citations are 100% stable, reproducible, and verifiable across frontend rendering and backend analysis.
- **Positive**: Eliminates multi-byte encoding discrepancies (such as emoji, smart quotes, or accented characters).
- **Tradeoff**: Ingestion incurs a one-time serialization and parsing overhead to structure and index document blocks before analysis.
