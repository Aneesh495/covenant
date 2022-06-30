import { z } from "zod";

export const FindingSeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);
export const FindingConfidenceSchema = z.enum(["high", "medium", "low"]);
export const ReviewDecisionStateSchema = z.enum(["pending", "accepted", "dismissed", "modified"]);
export const DocumentTypeSchema = z.enum(["contract", "resume", "job_description", "policy"]);
export const AnalysisWorkflowSchema = z.enum([
  "contract_review",
  "contract_comparison",
  "resume_intelligence",
  "bullet_revision",
]);

export const BoundingBoxCoordinatesSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

export const GroundedCitationSchema = z.object({
  id: z.string().min(1),
  blockId: z.string().min(1),
  pageNumber: z.number().int().positive(),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
  exactQuote: z.string().min(1),
  confidence: z.number().min(0).max(1),
  sourceType: z.enum(["digital_text", "ocr"]),
  boundingBox: BoundingBoxCoordinatesSchema.optional(),
});

export const RedlinePatchSchema = z.object({
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
  originalText: z.string().min(1),
  replacementText: z.string(),
  explanation: z.string().min(1),
});

export const GroundedFindingSchema = z.object({
  id: z.string().min(1),
  workflow: AnalysisWorkflowSchema,
  ruleId: z.string().optional(),
  category: z.string().min(1),
  severity: FindingSeveritySchema,
  title: z.string().min(1),
  explanation: z.string().min(1),
  suggestedAction: z.string().optional(),
  suggestedPatch: RedlinePatchSchema.optional(),
  citations: z.array(GroundedCitationSchema),
  confidence: FindingConfidenceSchema,
  decisionState: ReviewDecisionStateSchema.default("pending"),
  decisionNote: z.string().optional(),
  decidedAt: z.string().optional(),
  decidedBy: z.string().optional(),
});

export const UpdateDecisionSchema = z.object({
  decisionState: ReviewDecisionStateSchema,
  decisionNote: z.string().max(1000).optional(),
});

export const CreateTaskRequestSchema = z.object({
  workflow: AnalysisWorkflowSchema,
  documentVersionId: z.string().min(1),
  comparisonVersionId: z.string().optional(),
  roleDescriptionText: z.string().optional(),
  policyId: z.string().optional(),
  modelProvider: z.enum(["local", "hosted", "recorded", "deterministic"]).default("deterministic"),
});

export const BulletRevisionRequestSchema = z.object({
  documentVersionId: z.string().min(1),
  bulletCitationId: z.string().min(1),
  originalBulletText: z.string().min(5),
  targetRoleRequirementId: z.string().optional(),
  targetRoleRequirementText: z.string().optional(),
  styleGoal: z.enum(["quantify_impact", "action_oriented", "concise", "keyword_alignment"]).default("quantify_impact"),
});

export const ModelInvocationMetadataSchema = z.object({
  provider: z.enum(["local", "hosted", "recorded", "deterministic"]),
  modelName: z.string(),
  modelRevision: z.string().optional(),
  promptHash: z.string(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  latencyMs: z.number().nonnegative(),
  isLive: z.boolean(),
  isRecorded: z.boolean(),
  isDeterministic: z.boolean(),
});
