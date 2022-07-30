# ADR-005: Factual Guardrails and Metric Preservation in Resume Intelligence

## Status
Accepted

## Context
Automated resume improvement tools and LLM rewrite prompts are prone to hallucinating facts. Common failure modes include fabricating quantitative metrics (e.g. inventing "increased revenue by 35%"), claiming unverified technical skills (e.g. adding Kubernetes to a profile that never mentioned container orchestration), or altering company tenures. In employment and talent intelligence, fabricated claims destroy trust and expose candidates to disqualification.

## Decision
We establish a zero-hallucination validation pipeline (`FactualRewriteValidator`) that audits every generated bullet rewrite before presenting it to the reviewer:

1. **Strict Metric Preservation**:
   All numbers, percentages, dollar figures, and throughput rates in a rewritten bullet must be grounded in the source candidate profile:
   $$\forall m \in \text{Metrics}(\text{Rewrite}), \quad m \in \text{Metrics}(\text{SourceBullet}) \cup \text{Metrics}(\text{CandidateProfile})$$
   Any revision that introduces an ungrounded number is rejected.

2. **Entity and Skill Grounding**:
   Any technical skill, vendor, or organizational entity in a rewritten bullet must match known entities extracted from the candidate profile's explicit experience or education records.

3. **Verification Ledger and Provenance**:
   Each bullet revision record preserves an explicit validation outcome:
   - `preservedMetrics`: List of successfully verified numbers.
   - `hallucinatedMetrics`: Any ungrounded numbers detected.
   - `unsupportedEntities`: Any ungrounded tools or entities.
   - `passedVerification`: Boolean indicator (must be true for presentation).

## Consequences
- **Positive**: Guarantees 100% factual integrity in candidate revisions; zero fabricated metrics or credentials.
- **Positive**: Candidate profiles remain strictly factual representations of verified work history.
- **Tradeoff**: Rewrites that attempt to provide creative hypothetical metrics are rejected by design, requiring the user to supply factual inputs first.
