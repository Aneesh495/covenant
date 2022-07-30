# ADR-003: Hybrid Retrieval with Reciprocal Rank Fusion (RRF)

## Status
Accepted

## Context
Document intelligence tasks across legal contracts and technical resumes require locating both exact legal terms (e.g. "Section 4.2", "Delaware", "Net 30") and broad conceptual requirements (e.g. "consensus-driven storage", "indemnification remedies"). Dense vector embeddings excel at semantic similarity but frequently miss exact token numbers, proper nouns, and short statutory references. Conversely, pure keyword search misses synonyms and conceptually related requirements.

## Decision
We implement a three-channel hybrid retrieval engine synthesized via Reciprocal Rank Fusion (RRF):

1. **BM25 Lexical Channel**:
   Evaluates term frequency, inverse document frequency, and document length normalization ($k_1 = 1.2, b = 0.75$) over stemmed tokens with stopword filtering.

2. **Dense Vector Channel**:
   Generates 384-dimensional dense semantic vector representations for document chunks and queries, calculating cosine distance against indexed chunks.

3. **Exact Substring Channel**:
   Executes exact, case-insensitive substring scoring to boost exact legal section numbers, acronyms, and candidate company names.

4. **Reciprocal Rank Fusion**:
   Rankings are aggregated using reciprocal rank fusion with a rank constant $k = 60$:
   $$RRF(d) = \sum_{c} \frac{w_c}{60 + r_c(d)}$$
   Weights are configured to balance precision and recall: Dense ($w = 1.0$), BM25 ($w = 0.8$), Exact ($w = 1.2$).

## Consequences
- **Positive**: High recall for broad concepts combined with high precision for exact section references and proper nouns.
- **Positive**: Does not require manual score calibration or normalization across wildly different metric scales (cosine distance vs BM25 unbounded scores).
- **Tradeoff**: Ingesting documents requires computing both inverted term indexes and dense embedding vectors.
