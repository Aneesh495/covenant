import { DocumentIngestionEngine } from "@covenant/ingestion";
import { ResumeIntelligencePipeline, FactualRewriteValidator } from "@covenant/resume-pipeline";
import {
  ResumeEvalCase,
  CaseMetricResult,
  ResumeEvaluationSummary,
  DatasetSplit,
} from "../types";
import { RESUME_EVALUATION_CASES } from "../datasets/resume_cases";

export interface ResumeEvaluatorOptions {
  split?: DatasetSplit;
  cases?: ResumeEvalCase[];
}

export class ResumeEvaluator {
  private ingestionEngine = new DocumentIngestionEngine();
  private pipeline = new ResumeIntelligencePipeline();
  private validator = new FactualRewriteValidator();

  async evaluateSuite(options: ResumeEvaluatorOptions = {}): Promise<ResumeEvaluationSummary> {
    const allCases = options.cases || RESUME_EVALUATION_CASES;
    const casesToRun = options.split
      ? allCases.filter((c) => c.split === options.split)
      : allCases;

    const caseResults: CaseMetricResult[] = [];
    let profileAccuracyTotal = 0;
    let matchAccuracyTotal = 0;
    let factPreservationTotal = 0;
    let totalRevisionsTested = 0;
    let totalValidRevisions = 0;

    for (const testCase of casesToRun) {
      const result = await this.evaluateSingleCase(testCase);
      caseResults.push(result.metricResult);

      profileAccuracyTotal += result.profileAccuracy;
      matchAccuracyTotal += result.matchAccuracy;
      totalRevisionsTested += result.revisionsTested;
      totalValidRevisions += result.validRevisions;
    }

    const n = Math.max(1, caseResults.length);
    const profileAccuracy = profileAccuracyTotal / n;
    const matchClassificationAccuracy = matchAccuracyTotal / n;
    const factPreservationScore = totalRevisionsTested > 0
      ? totalValidRevisions / totalRevisionsTested
      : 1.0;

    const devCases = caseResults.filter((r) => r.split === "dev").length;
    const heldOutCases = caseResults.filter((r) => r.split === "held_out").length;

    return {
      totalCases: caseResults.length,
      devCases,
      heldOutCases,
      profileAccuracy: Math.round(profileAccuracy * 1000) / 1000,
      matchClassificationAccuracy: Math.round(matchClassificationAccuracy * 1000) / 1000,
      factPreservationScore: Math.round(factPreservationScore * 1000) / 1000,
      caseResults,
    };
  }

  async evaluateSingleCase(testCase: ResumeEvalCase): Promise<{
    metricResult: CaseMetricResult;
    profileAccuracy: number;
    matchAccuracy: number;
    revisionsTested: number;
    validRevisions: number;
  }> {
    const errors: string[] = [];

    // 1. Ingest document
    const docIR = await this.ingestionEngine.ingest({
      buffer: Buffer.from(testCase.resumeText, "utf-8"),
      filename: `${testCase.id}.txt`,
      mediaType: "text/plain",
    });

    // 2. Execute resume pipeline
    const output = this.pipeline.analyzeResume(docIR, {
      jobDescription: testCase.jobDescription,
    });

    // 3. Evaluate Profile Accuracy
    let profileScore = 0;
    const yoe = output.profile.totalExperienceYears;
    const yoeValid = yoe >= testCase.expectedMinExperienceYears - 0.5 && yoe <= testCase.expectedMaxExperienceYears + 2.0;
    if (yoeValid) {
      profileScore += 0.5;
    } else {
      errors.push(`YOE mismatch: expected between ${testCase.expectedMinExperienceYears} and ${testCase.expectedMaxExperienceYears}, got ${yoe}`);
    }

    const extractedSkillNames = new Set(
      output.profile.skills.flatMap((s) => {
        const n = s.name.toLowerCase();
        if (n === "amazon web services") return [n, "aws"];
        if (n === "google cloud platform") return [n, "gcp"];
        if (n === "kubernetes") return [n, "k8s"];
        return [n];
      })
    );
    let matchedSkills = 0;
    for (const expSkill of testCase.expectedSkills) {
      if (extractedSkillNames.has(expSkill.toLowerCase())) {
        matchedSkills++;
      }
    }
    const skillRatio = testCase.expectedSkills.length > 0 ? matchedSkills / testCase.expectedSkills.length : 1.0;
    profileScore += skillRatio * 0.5;

    // 4. Evaluate Requirement Match Accuracy
    let matchScore = 0;
    let expectedMatchedCount = 0;
    const matches = output.coverageMatrix?.matches || [];
    for (const expMatch of testCase.expectedMatches) {
      const match = matches.find((m) =>
        m.requirementText.toLowerCase().includes(expMatch.requirementSnippet.toLowerCase())
      );
      if (match) {
        if (match.status === expMatch.expectedStatus || (expMatch.expectedStatus !== "supported" && match.status !== "supported")) {
          expectedMatchedCount++;
        } else {
          errors.push(`Requirement '${expMatch.requirementSnippet}' expected status ${expMatch.expectedStatus} but got ${match.status}`);
        }
      } else {
        errors.push(`Requirement '${expMatch.requirementSnippet}' not found in matches.`);
      }
    }
    matchScore = testCase.expectedMatches.length > 0 ? expectedMatchedCount / testCase.expectedMatches.length : 1.0;

    // 5. Evaluate Fact Preservation of Bullet Revisions
    let revisionsTested = 0;
    let validRevisions = 0;
    for (const rev of output.bulletRevisions) {
      revisionsTested++;
      const valResult = this.validator.validateRewrite(rev.originalText, rev.rewrittenText);
      if (valResult.isValid) {
        validRevisions++;
      } else {
        errors.push(`Fact preservation failure: ${valResult.violations.join("; ")}`);
      }
    }

    const caseScore = (profileScore + matchScore) / 2;
    const passed = caseScore >= 0.70;

    return {
      metricResult: {
        caseId: testCase.id,
        title: testCase.title,
        split: testCase.split,
        passed,
        score: Math.round(caseScore * 100) / 100,
        details: {
          yoe,
          extractedSkillsCount: output.profile.skills.length,
          matchedRequirementsCount: matches.length,
          revisionsTested,
          validRevisions,
        },
        errors: errors.length > 0 ? errors : undefined,
      },
      profileAccuracy: profileScore,
      matchAccuracy: matchScore,
      revisionsTested,
      validRevisions,
    };
  }
}
