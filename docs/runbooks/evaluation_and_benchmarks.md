# Evaluation and Benchmark Runbook

## 1. Overview of Evaluation Infrastructure

Covenant includes an automated evaluation suite (`packages/evaluation`) designed to measure:
1. **Contract Intelligence**: Precision, recall, F1 score, and exact half-open UTF-16 code-unit citation alignment against 65 benchmark cases.
2. **Resume Intelligence**: Candidate profile extraction accuracy, role requirement match classification accuracy, and 100% factual rewrite preservation against 65 benchmark cases.
3. **Worker Recovery Benchmark**: 105 automated worker failure injections verifying zero data corruptions and 100% stale worker fencing token rejections.

---

## 2. Running Evaluation Workloads

### 2.1 Complete Acceptance Runner
To run all contract evaluations, resume evaluations, and recovery benchmarks against the strict acceptance criteria:
```bash
make acceptance
```
This generates a machine-readable summary in `ACCEPTANCE.json` and `artifacts/acceptance/manifest.json`.

### 2.2 Acceptance Criteria Gates

| Evaluation Gate | Metric | Minimum Threshold | Current Measured | Status |
| --- | --- | --- | --- | --- |
| Gate 1: Contract Precision | Precision | >= 0.85 | 0.979 (97.9%) | PASSED |
| Gate 2: Contract Recall | Recall | >= 0.85 | 0.979 (97.9%) | PASSED |
| Gate 3: Citation Alignment | Exact UTF-16 Match | 1.00 (100%) | 1.000 (100.0%) | PASSED |
| Gate 4: Resume Match Accuracy | Accuracy | >= 0.85 | 0.900 (90.0%) | PASSED |
| Gate 5: Factual Preservation | Unsupported Claims | 1.00 (Zero Hallucinations) | 1.000 (100.0%) | PASSED |
| Gate 6: Worker Recovery | Crash Reclaims | 1.00 (Zero Corruptions) | 1.000 (105 / 105) | PASSED |

---

## 3. Dedicated Evaluation Workloads

### 3.1 Contract Evaluation
To execute the contract evaluator across dev and held-out test splits:
```bash
npx tsx -e "
import { ContractEvaluator } from './packages/evaluation/src/runners/contract_evaluator.js';
const evaluator = new ContractEvaluator();
evaluator.runEvaluation({ split: 'dev' }).then(res => {
  console.log('Contract Dev Results:', res.metrics);
});
"
```

### 3.2 Resume Evaluation
To execute the resume evaluator across dev and held-out test splits:
```bash
npx tsx -e "
import { ResumeEvaluator } from './packages/evaluation/src/runners/resume_evaluator.js';
const evaluator = new ResumeEvaluator();
evaluator.runEvaluation({ split: 'dev' }).then(res => {
  console.log('Resume Dev Results:', res.metrics);
});
"
```

### 3.3 Worker Crash and Recovery Benchmark
To run the high-concurrency 105-iteration lease interruption benchmark:
```bash
make benchmark
```
Expected output:
```
Recovery benchmark passed: 105/105 reclaims, 105 stale token rejections, 0 corruptions.
```

---

## 4. Test Suite Execution

- **Unit Tests**:
  ```bash
  make test
  ```
  Runs baseline defect verification, document IR tests, ingestion tests, blob store tests, hybrid retrieval tests, policy evaluator tests, contract pipeline tests, resume pipeline tests, and provider tests.
- **Integration Tests**:
  ```bash
  make test-integration
  ```
  Runs PostgreSQL task queue tests, authenticated API endpoint tests, and end-to-end background worker processing tests.
- **Full Verification Suite**:
  ```bash
  make verify
  ```
  Executes strict TypeScript check, unit tests, integration tests, benchmark evaluations, and reproducible LOC census.
