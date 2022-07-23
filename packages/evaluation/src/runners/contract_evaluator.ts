import { DocumentIngestionEngine } from "@covenant/ingestion";
import { ContractReviewPipeline } from "@covenant/contract-pipeline";
import {
  ContractEvalCase,
  CaseMetricResult,
  ContractEvaluationSummary,
  DatasetSplit,
} from "../types";
import { CONTRACT_EVALUATION_CASES } from "../datasets/contract_cases";

export interface ContractEvaluatorOptions {
  split?: DatasetSplit;
  cases?: ContractEvalCase[];
}

export class ContractEvaluator {
  private ingestionEngine = new DocumentIngestionEngine();
  private pipeline = new ContractReviewPipeline();

  async evaluateSuite(options: ContractEvaluatorOptions = {}): Promise<ContractEvaluationSummary> {
    const allCases = options.cases || CONTRACT_EVALUATION_CASES;
    const casesToRun = options.split
      ? allCases.filter((c) => c.split === options.split)
      : allCases;

    const caseResults: CaseMetricResult[] = [];
    let totalTp = 0;
    let totalFp = 0;
    let totalFn = 0;
    let totalCitations = 0;
    let alignedCitations = 0;

    for (const testCase of casesToRun) {
      const result = await this.evaluateSingleCase(testCase);
      caseResults.push(result.metricResult);

      totalTp += result.tp;
      totalFp += result.fp;
      totalFn += result.fn;
      totalCitations += result.totalCitations;
      alignedCitations += result.alignedCitations;
    }

    const precision = totalTp + totalFp > 0 ? totalTp / (totalTp + totalFp) : 1.0;
    const recall = totalTp + totalFn > 0 ? totalTp / (totalTp + totalFn) : 1.0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 1.0;
    const citationAlignmentScore = totalCitations > 0 ? alignedCitations / totalCitations : 1.0;

    const devCases = caseResults.filter((r) => r.split === "dev").length;
    const heldOutCases = caseResults.filter((r) => r.split === "held_out").length;

    return {
      totalCases: caseResults.length,
      devCases,
      heldOutCases,
      precision: Math.round(precision * 1000) / 1000,
      recall: Math.round(recall * 1000) / 1000,
      f1: Math.round(f1 * 1000) / 1000,
      citationAlignmentScore: Math.round(citationAlignmentScore * 1000) / 1000,
      caseResults,
    };
  }

  async evaluateSingleCase(testCase: ContractEvalCase): Promise<{
    metricResult: CaseMetricResult;
    tp: number;
    fp: number;
    fn: number;
    totalCitations: number;
    alignedCitations: number;
  }> {
    const errors: string[] = [];

    // 1. Ingest document
    const docIR = await this.ingestionEngine.ingest({
      buffer: Buffer.from(testCase.canonicalText, "utf-8"),
      filename: `${testCase.id}.txt`,
      mediaType: "text/plain",
    });

    // 2. Execute contract intelligence pipeline
    const output = this.pipeline.analyzeContract(docIR, {
      playbookType: testCase.playbookType,
    });

    // 3. Score findings precision and recall
    const actualRuleIds = new Set(output.findings.map((f) => f.ruleId).filter(Boolean));
    const expectedRuleIds = new Set(testCase.expectedFindings.map((e) => e.ruleId));

    let tp = 0;
    let fp = 0;
    let fn = 0;

    for (const actualId of Array.from(actualRuleIds)) {
      if (expectedRuleIds.has(actualId as string)) {
        tp++;
      } else {
        fp++;
      }
    }

    for (const expectedId of Array.from(expectedRuleIds)) {
      if (!actualRuleIds.has(expectedId)) {
        fn++;
        errors.push(`Expected rule ${expectedId} not detected.`);
      }
    }

    // 4. Verify citation alignment against canonical text
    let totalCitations = 0;
    let alignedCitations = 0;

    for (const finding of output.findings) {
      for (const citation of finding.citations) {
        totalCitations++;
        const sliced = docIR.canonicalText.slice(citation.startOffset, citation.endOffset);
        if (sliced === citation.exactQuote && sliced.length > 0) {
          alignedCitations++;
        } else {
          errors.push(`Citation mismatch at [${citation.startOffset}, ${citation.endOffset}) for finding ${finding.id}`);
        }
      }
    }

    const caseScore = expectedRuleIds.size === 0
      ? (fp === 0 ? 1.0 : 0.0)
      : tp / (tp + fp + fn);

    const passed = caseScore >= 0.75 && (totalCitations === 0 || alignedCitations === totalCitations);

    return {
      metricResult: {
        caseId: testCase.id,
        title: testCase.title,
        split: testCase.split,
        passed,
        score: Math.round(caseScore * 100) / 100,
        details: {
          findingsCount: output.findings.length,
          expectedCount: testCase.expectedFindings.length,
          tp,
          fp,
          fn,
          totalCitations,
          alignedCitations,
        },
        errors: errors.length > 0 ? errors : undefined,
      },
      tp,
      fp,
      fn,
      totalCitations,
      alignedCitations,
    };
  }
}
