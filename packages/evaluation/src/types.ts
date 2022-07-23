export type DatasetSplit = "dev" | "held_out";

export interface ExpectedFinding {
  ruleId: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  expectedTextSnippet?: string;
}

export interface ContractEvalCase {
  id: string;
  title: string;
  documentType: "nda" | "employment" | "services" | "vendor" | "software_license" | "dpa";
  playbookType: string;
  split: DatasetSplit;
  canonicalText: string;
  expectedParties?: string[];
  expectedGoverningLaw?: string;
  expectedFindings: ExpectedFinding[];
  minExpectedClauses?: number;
  description: string;
}

export interface ExpectedRequirementMatch {
  requirementSnippet: string;
  expectedStatus: "supported" | "partially_supported" | "unsupported";
  minScore?: number;
}

export interface ResumeEvalCase {
  id: string;
  title: string;
  candidateName: string;
  split: DatasetSplit;
  resumeText: string;
  jobDescription: string;
  expectedMinExperienceYears: number;
  expectedMaxExperienceYears: number;
  expectedSkills: string[];
  expectedMatches: ExpectedRequirementMatch[];
  expectedAtsDefects?: string[];
  description: string;
}

export interface CaseMetricResult {
  caseId: string;
  title: string;
  split: DatasetSplit;
  passed: boolean;
  score: number; // 0 to 1
  details: Record<string, unknown>;
  errors?: string[];
}

export interface ContractEvaluationSummary {
  totalCases: number;
  devCases: number;
  heldOutCases: number;
  precision: number;
  recall: number;
  f1: number;
  citationAlignmentScore: number;
  caseResults: CaseMetricResult[];
}

export interface ResumeEvaluationSummary {
  totalCases: number;
  devCases: number;
  heldOutCases: number;
  profileAccuracy: number;
  matchClassificationAccuracy: number;
  factPreservationScore: number;
  caseResults: CaseMetricResult[];
}

export interface RecoveryBenchmarkResult {
  totalInterruptions: number;
  successfulReclaims: number;
  staleRejections: number;
  corruptionsDetected: number;
  durationMs: number;
  allEnforced: boolean;
}

export interface ComprehensiveAcceptanceReport {
  timestamp: string;
  gitCommit?: string;
  allGatesPassed: boolean;
  gates: {
    contractPrecision: { target: number; actual: number; passed: boolean };
    contractRecall: { target: number; actual: number; passed: boolean };
    citationAlignment: { target: number; actual: number; passed: boolean };
    resumeMatchAccuracy: { target: number; actual: number; passed: boolean };
    factPreservation: { target: number; actual: number; passed: boolean };
    workerRecovery: { target: number; actual: number; passed: boolean };
  };
  contractEvaluation: ContractEvaluationSummary;
  resumeEvaluation: ResumeEvaluationSummary;
  recoveryBenchmark: RecoveryBenchmarkResult;
}
