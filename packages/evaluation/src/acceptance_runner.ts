import fs from "fs";
import path from "path";
import pg from "pg";
import { ContractEvaluator } from "./runners/contract_evaluator";
import { ResumeEvaluator } from "./runners/resume_evaluator";
import { RecoveryBenchmarkRunner } from "./runners/recovery_benchmark";
import { ComprehensiveAcceptanceReport } from "./types";

export interface AcceptanceRunnerOptions {
  pool?: pg.Pool;
  skipRecovery?: boolean;
  recoveryIterations?: number;
  outputDir?: string;
}

export class AcceptanceRunner {
  private contractEvaluator = new ContractEvaluator();
  private resumeEvaluator = new ResumeEvaluator();

  async runAll(options: AcceptanceRunnerOptions = {}): Promise<ComprehensiveAcceptanceReport> {
    console.log("[Acceptance] Starting full evaluation suite and benchmark run...");

    // 1. Run Contract Intelligence Evaluation
    console.log("[Acceptance] Running contract intelligence evaluation across 65 cases...");
    const contractResult = await this.contractEvaluator.evaluateSuite();
    console.log(
      `[Acceptance] Contract Precision: ${contractResult.precision}, Recall: ${contractResult.recall}, F1: ${contractResult.f1}, Citation Alignment: ${contractResult.citationAlignmentScore}`
    );

    // 2. Run Resume Intelligence Evaluation
    console.log("[Acceptance] Running resume intelligence evaluation across 65 cases...");
    const resumeResult = await this.resumeEvaluator.evaluateSuite();
    console.log(
      `[Acceptance] Resume Profile Accuracy: ${resumeResult.profileAccuracy}, Match Accuracy: ${resumeResult.matchClassificationAccuracy}, Fact Preservation: ${resumeResult.factPreservationScore}`
    );

    // 3. Run Recovery Benchmark (100+ simulated interruptions)
    let recoveryResult = {
      totalInterruptions: 0,
      successfulReclaims: 0,
      staleRejections: 0,
      corruptionsDetected: 0,
      durationMs: 0,
      allEnforced: true,
    };

    if (!options.skipRecovery) {
      const iterations = options.recoveryIterations ?? 105;
      console.log(`[Acceptance] Running worker recovery benchmark across ${iterations} interruptions...`);
      const recoveryRunner = new RecoveryBenchmarkRunner(options.pool);
      recoveryResult = await recoveryRunner.runBenchmark({ iterations });
      console.log(
        `[Acceptance] Recovery Benchmark: ${recoveryResult.successfulReclaims}/${recoveryResult.totalInterruptions} reclaimed, ${recoveryResult.staleRejections} stale workers rejected, ${recoveryResult.corruptionsDetected} corruptions.`
      );
    }

    // 4. Evaluate Gates
    const gates = {
      contractPrecision: {
        target: 0.80,
        actual: contractResult.precision,
        passed: contractResult.precision >= 0.80,
      },
      contractRecall: {
        target: 0.80,
        actual: contractResult.recall,
        passed: contractResult.recall >= 0.80,
      },
      citationAlignment: {
        target: 0.90,
        actual: contractResult.citationAlignmentScore,
        passed: contractResult.citationAlignmentScore >= 0.90,
      },
      resumeMatchAccuracy: {
        target: 0.80,
        actual: resumeResult.matchClassificationAccuracy,
        passed: resumeResult.matchClassificationAccuracy >= 0.80,
      },
      factPreservation: {
        target: 0.99,
        actual: resumeResult.factPreservationScore,
        passed: resumeResult.factPreservationScore >= 0.99,
      },
      workerRecovery: {
        target: 1.0,
        actual: recoveryResult.allEnforced ? 1.0 : 0.0,
        passed: recoveryResult.allEnforced,
      },
    };

    const allGatesPassed = Object.values(gates).every((g) => g.passed);

    const report: ComprehensiveAcceptanceReport = {
      timestamp: new Date().toISOString(),
      allGatesPassed,
      gates,
      contractEvaluation: contractResult,
      resumeEvaluation: resumeResult,
      recoveryBenchmark: recoveryResult,
    };

    // 5. Write artifacts
    const outputDir = options.outputDir || "./artifacts/acceptance";
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(outputDir, "manifest.json"),
      JSON.stringify(report, null, 2),
      "utf-8"
    );

    fs.writeFileSync(
      path.join(".", "ACCEPTANCE.json"),
      JSON.stringify(report, null, 2),
      "utf-8"
    );

    console.log(`[Acceptance] Evaluation complete. All gates passed: ${allGatesPassed}. Report written to ${outputDir}/manifest.json`);
    return report;
  }
}

// CLI entrypoint
if (
  process.argv[1] &&
  (process.argv[1].endsWith("acceptance_runner.ts") || process.argv[1].endsWith("acceptance_runner.js"))
) {
  const runner = new AcceptanceRunner();
  runner
    .runAll()
    .then((report) => {
      process.exit(report.allGatesPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
