import { GroundedFinding, GroundedCitation } from "@covenant/shared";

export interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface ExperienceRole {
  id: string;
  company: string;
  title: string;
  startDateText: string;
  endDateText: string;
  startMonthYear?: { year: number; month: number }; // 1-12
  endMonthYear?: { year: number; month: number }; // 1-12 or undefined if current
  isCurrent: boolean;
  location?: string;
  bullets: Array<{
    text: string;
    canonicalStart: number;
    canonicalEnd: number;
    blockId: string;
  }>;
  canonicalStart: number;
  canonicalEnd: number;
  blockId: string;
}

export interface EducationEntry {
  id: string;
  institution: string;
  degree?: string; // e.g. "Bachelor of Science", "Master of Science", "PhD"
  fieldOfStudy?: string; // e.g. "Computer Science", "Electrical Engineering"
  graduationYear?: number;
  canonicalStart: number;
  canonicalEnd: number;
  blockId: string;
}

export interface ExtractedSkill {
  name: string;
  normalizedName: string;
  category: "language" | "framework" | "database" | "cloud" | "tool" | "concept" | "other";
  source: "explicit" | "inferred";
  evidenceText?: string;
  canonicalStart?: number;
  canonicalEnd?: number;
  blockId?: string;
}

export interface CandidateProfile {
  id: string;
  contact: ContactInfo;
  summaryText?: string;
  roles: ExperienceRole[];
  totalExperienceMonths: number;
  totalExperienceYears: number;
  education: EducationEntry[];
  skills: ExtractedSkill[];
  certifications: string[];
}

export type RequirementCategory =
  | "skill"
  | "experience_years"
  | "education"
  | "domain_knowledge"
  | "leadership"
  | "credential";

export type RequirementPriority = "required" | "preferred";

export interface RoleRequirement {
  id: string;
  category: RequirementCategory;
  priority: RequirementPriority;
  rawText: string;
  normalizedTerms: string[];
  minYears?: number;
  degreeLevel?: "bachelors" | "masters" | "doctorate";
}

export type RequirementMatchStatus =
  | "supported"
  | "partially_supported"
  | "unsupported"
  | "unknown";

export interface RequirementMatch {
  requirementId: string;
  requirementText: string;
  category: RequirementCategory;
  priority: RequirementPriority;
  status: RequirementMatchStatus;
  score: number; // 0.0 to 1.0
  explanation: string;
  citations: GroundedCitation[];
}

export interface RequirementCoverageMatrix {
  totalRequirements: number;
  requiredCount: number;
  preferredCount: number;
  supportedCount: number;
  partiallySupportedCount: number;
  unsupportedCount: number;
  overallMatchScore: number; // 0 to 100
  requiredMatchScore: number; // 0 to 100
  preferredMatchScore: number; // 0 to 100
  matches: RequirementMatch[];
}

export interface AtsCheckItem {
  id: string;
  name: string;
  category: "formatting" | "structure" | "content" | "quantification" | "chronology";
  passed: boolean;
  score: number; // 0 to 100
  severity: "critical" | "high" | "medium" | "low" | "info";
  message: string;
  details?: Record<string, unknown>;
}

export interface AtsAuditResult {
  overallScore: number; // 0 to 100
  passedChecksCount: number;
  totalChecksCount: number;
  checks: AtsCheckItem[];
  findings: GroundedFinding[];
}

export interface FactualValidationResult {
  isValid: boolean;
  violations: string[];
  preservedMetrics: string[];
  hallucinatedMetrics: string[];
  unsupportedEntities: string[];
}

export interface BulletRevisionItem {
  id: string;
  originalText: string;
  rewrittenText: string;
  startOffset: number;
  endOffset: number;
  blockId: string;
  rationale: string;
  validation: FactualValidationResult;
  passedVerification: boolean;
}

export interface ResumeAnalysisOutput {
  documentId: string;
  profile: CandidateProfile;
  coverageMatrix?: RequirementCoverageMatrix;
  atsAudit: AtsAuditResult;
  bulletRevisions: BulletRevisionItem[];
  findings: GroundedFinding[];
  summary: {
    totalRoles: number;
    totalYearsExperience: number;
    totalSkillsCount: number;
    atsScore: number;
    roleMatchScore?: number;
    revisionsGenerated: number;
    verifiedRevisionsCount: number;
  };
}
