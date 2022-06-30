export type DocumentType = "contract" | "resume" | "job_description" | "policy";

export type AnalysisWorkflow = "contract_review" | "contract_comparison" | "resume_intelligence" | "bullet_revision";

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export type FindingConfidence = "high" | "medium" | "low";

export type ReviewDecisionState = "pending" | "accepted" | "dismissed" | "modified";

export type WorkspaceRole = "owner" | "admin" | "reviewer" | "viewer";

export interface WorkspaceContext {
  workspaceId: string;
  userId?: string;
  role: WorkspaceRole;
}

export type TaskStatus = "pending" | "leased" | "running" | "completed" | "failed" | "canceled";

export interface RedlinePatch {
  startOffset: number;
  endOffset: number;
  originalText: string;
  replacementText: string;
  explanation: string;
}

export interface BoundingBoxCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GroundedCitation {
  id: string;
  blockId: string;
  pageNumber: number;
  startOffset: number; // Half-open UTF-16 code unit offset in canonical text
  endOffset: number;   // Half-open UTF-16 code unit offset in canonical text
  exactQuote: string;
  confidence: number;  // 0.0 to 1.0
  sourceType: "digital_text" | "ocr";
  boundingBox?: BoundingBoxCoordinates;
}

export interface ModelInvocationMetadata {
  provider: "local" | "hosted" | "recorded" | "deterministic";
  modelName: string;
  modelRevision?: string;
  promptHash: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  isLive: boolean;
  isRecorded: boolean;
  isDeterministic: boolean;
}

export interface GroundedFinding {
  id: string;
  workflow: AnalysisWorkflow;
  ruleId?: string;
  category: string;
  severity: FindingSeverity;
  title: string;
  explanation: string;
  suggestedAction?: string;
  suggestedPatch?: RedlinePatch;
  citations: GroundedCitation[];
  confidence: FindingConfidence;
  decisionState: ReviewDecisionState;
  decisionNote?: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface ContractAnalysisSummary {
  overallRiskLevel: FindingSeverity;
  criticalIssues: string[];
  recommendations: string[];
  missingClauses: string[];
  clauseCountsByCategory: Record<string, number>;
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  coverageRate: number; // 0.0 to 1.0 proportion of analyzed scope
}

export interface RequirementMatch {
  requirementId: string;
  requirementText: string;
  requirementType: "required" | "preferred";
  category: "skill" | "experience" | "education" | "domain" | "certification";
  status: "supported" | "partially_supported" | "unsupported" | "unknown";
  confidence: number;
  reasoning: string;
  resumeCitations: GroundedCitation[];
  roleCitations: GroundedCitation[];
}

export interface AtsInspectionCheck {
  id: string;
  title: string;
  passed: boolean;
  category: "structure" | "readability" | "specificity" | "repetition" | "chronology" | "text_order";
  observation: string;
  recommendation?: string;
  affectedCitations?: GroundedCitation[];
}

export interface ResumeAnalysisSummary {
  overallScore: number; // 1 to 10
  rubricScores: {
    experienceMatch: number;
    skillsCoverage: number;
    educationAndCredentials: number;
    impactAndQuantification: number;
    formattingAndStructure: number;
  };
  supportedRequirementsCount: number;
  partialRequirementsCount: number;
  unsupportedRequirementsCount: number;
  totalRequirementsCount: number;
  coverageRatio: number; // 0.0 to 1.0
  atsChecks: AtsInspectionCheck[];
  keyStrengths: string[];
  identifiedGaps: string[];
  recommendations: string[];
}
