import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import {
  CONTRACT_EVALUATION_CASES,
  RESUME_EVALUATION_CASES,
  ContractEvaluator,
  ResumeEvaluator,
  RecoveryBenchmarkRunner,
} from "@covenant/evaluation";

const testDbUrl = process.env.DATABASE_URL || "postgres://localhost:5432/covenant_test";
const pool = new pg.Pool({ connectionString: testDbUrl });

describe("Evaluation Corpus and Benchmark Suites", () => {
  beforeAll(async () => {
    // Ensure clean state for benchmark tests
    await pool.query(
      "TRUNCATE TABLE audit_events, citations, findings, analysis_runs, analysis_tasks, source_blocks, document_versions, documents, workspaces CASCADE"
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it("verifies contract evaluation corpus size, splits, and authored diversity", () => {
    expect(CONTRACT_EVALUATION_CASES.length).toBeGreaterThanOrEqual(60);

    const devCases = CONTRACT_EVALUATION_CASES.filter((c) => c.split === "dev");
    const heldOutCases = CONTRACT_EVALUATION_CASES.filter((c) => c.split === "held_out");

    expect(devCases.length).toBeGreaterThanOrEqual(40);
    expect(heldOutCases.length).toBeGreaterThanOrEqual(15);

    // Verify all cases have distinct IDs and non-empty canonical text
    const ids = new Set<string>();
    for (const c of CONTRACT_EVALUATION_CASES) {
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(c.canonicalText.length).toBeGreaterThan(50);
      expect(c.title.length).toBeGreaterThan(5);
    }
  });

  it("verifies resume evaluation corpus size, splits, and authored diversity", () => {
    expect(RESUME_EVALUATION_CASES.length).toBeGreaterThanOrEqual(60);

    const devCases = RESUME_EVALUATION_CASES.filter((c) => c.split === "dev");
    const heldOutCases = RESUME_EVALUATION_CASES.filter((c) => c.split === "held_out");

    expect(devCases.length).toBeGreaterThanOrEqual(40);
    expect(heldOutCases.length).toBeGreaterThanOrEqual(15);

    const ids = new Set<string>();
    for (const c of RESUME_EVALUATION_CASES) {
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(c.resumeText.length).toBeGreaterThan(50);
      expect(c.jobDescription.length).toBeGreaterThan(20);
      expect(c.expectedSkills.length).toBeGreaterThan(0);
    }
  });

  it("runs contract evaluation on dev split with high precision and exact citation alignment", async () => {
    const evaluator = new ContractEvaluator();
    // Test on sample of dev cases for fast test verification
    const devSample = CONTRACT_EVALUATION_CASES.filter((c) => c.split === "dev").slice(0, 15);
    const summary = await evaluator.evaluateSuite({ cases: devSample });

    expect(summary.totalCases).toBe(15);
    expect(summary.precision).toBeGreaterThanOrEqual(0.75);
    expect(summary.citationAlignmentScore).toBeGreaterThanOrEqual(0.95);
  });

  it("runs resume evaluation on dev split with profile accuracy and fact preservation", async () => {
    const evaluator = new ResumeEvaluator();
    const devSample = RESUME_EVALUATION_CASES.filter((c) => c.split === "dev").slice(0, 15);
    const summary = await evaluator.evaluateSuite({ cases: devSample });

    expect(summary.totalCases).toBe(15);
    expect(summary.profileAccuracy).toBeGreaterThanOrEqual(0.70);
    expect(summary.matchClassificationAccuracy).toBeGreaterThanOrEqual(0.70);
    expect(summary.factPreservationScore).toBe(1.0); // 100% preservation, zero unsupported claims
  });

  it("executes recovery benchmark verifying lease reclaiming and fencing token rejection", async () => {
    const runner = new RecoveryBenchmarkRunner(pool);
    // Run 5 iterations in unit test (acceptance suite runs 105)
    const result = await runner.runBenchmark({ iterations: 5, pool });

    expect(result.totalInterruptions).toBe(5);
    expect(result.successfulReclaims).toBe(5);
    expect(result.staleRejections).toBe(5);
    expect(result.corruptionsDetected).toBe(0);
    expect(result.allEnforced).toBe(true);
  });
});
