# ADR-004: Typed AST Policy DSL and Deterministic Evaluator

## Status
Accepted

## Context
Commercial contracts must comply with strict institutional risk guidelines (e.g. governing law restrictions, liability caps, termination notice periods, non-compete durations). Relying purely on generative language model prompts for policy compliance introduces hallucinations, non-deterministic flakiness, token cost overhead, and vulnerability to subtle model prompt drift.

## Decision
We implement a typed domain-specific language (DSL) based on Abstract Syntax Trees (ASTs) for defining review playbooks, accompanied by a deterministic evaluator:

1. **Typed Rule Primitives**:
   Rules are defined using structured predicates:
   - `clause_presence`: Asserts mandatory presence of specific clause categories.
   - `forbidden_terms`: Flags unacceptable language (e.g. unilateral indemnities, blanket consequential damage waivers).
   - `required_terms`: Verifies presence of mandatory safe-harbor terms.
   - `numeric_threshold`: Validates mathematical boundaries on numeric metrics (e.g. `confidentiality_duration_years <= 3`, `notice_period_days >= 14`, `payment_net_days >= 30`).
   - `obligation_bilateral`: Enforces reciprocity in rights and duties.
   - `governing_law`: Validates jurisdiction against institutional approved lists.

2. **Logical Combinators**:
   Conditions can be composed with boolean logic (`AND`, `OR`, `NOT`) into expressive evaluation trees.

3. **Suggested Redline Generation**:
   Each rule defines remediation metadata, including a templated compliant replacement patch and actionable guidance for contract negotiators.

4. **Zero-Model Utility**:
   When external language model APIs are unavailable, Covenant continues to evaluate contracts with full accuracy using the deterministic AST policy evaluator.

## Consequences
- **Positive**: 100% deterministic, audit-ready compliance evaluation with sub-millisecond execution latency.
- **Positive**: Eliminates prompt injection risks and non-deterministic compliance assessments.
- **Positive**: Allows legal engineering teams to author and version-control institutional review playbooks as code.
- **Tradeoff**: Highly nuanced, subjective contract clauses that cannot be reduced to structural conditions require supplemental contextual review.
