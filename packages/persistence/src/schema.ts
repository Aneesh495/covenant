import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";

// Custom pgvector type for vector embeddings
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(384)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(Number);
  },
});

// Workspaces for multi-tenant isolation
export const workspaces = pgTable("workspaces", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Workspace members with RBAC roles
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 64 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 64 }).notNull(),
    role: varchar("role", { length: 32 }).notNull().default("reviewer"), // owner, admin, reviewer, viewer
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uniq_workspace_member").on(table.workspaceId, table.userId),
    index("idx_workspace_members_user").on(table.userId),
  ]
);

// Users table
export const users = pgTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  isDemoUser: boolean("is_demo_user").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// PostgreSQL session store
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid", { length: 255 }).primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire", { withTimezone: true }).notNull(),
  },
  (table) => [index("idx_session_expire").on(table.expire)]
);

// Documents table scoped by workspace
export const documents = pgTable(
  "documents",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 64 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    documentType: varchar("document_type", { length: 32 }).notNull(), // contract, resume, job_description, policy
    title: varchar("title", { length: 255 }).notNull(),
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    currentVersionId: varchar("current_version_id", { length: 64 }),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_documents_workspace").on(table.workspaceId, table.isDeleted),
    index("idx_documents_type").on(table.workspaceId, table.documentType),
  ]
);

// Immutable document versions with content-addressed original blob link
export const documentVersions = pgTable(
  "document_versions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    documentId: varchar("document_id", { length: 64 })
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    workspaceId: varchar("workspace_id", { length: 64 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    mediaType: varchar("media_type", { length: 128 }).notNull(),
    storageUri: varchar("storage_uri", { length: 512 }).notNull(),
    extractorVersion: varchar("extractor_version", { length: 32 }).notNull(),
    pageCount: integer("page_count").notNull(),
    canonicalText: text("canonical_text").notNull(),
    documentIrJson: jsonb("document_ir_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uniq_doc_version").on(table.documentId, table.versionNumber),
    index("idx_doc_versions_sha").on(table.workspaceId, table.sha256),
  ]
);

// Source blocks indexed from DocumentIR for exact citation lookup
export const sourceBlocks = pgTable(
  "source_blocks",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    documentVersionId: varchar("document_version_id", { length: 64 })
      .notNull()
      .references(() => documentVersions.id, { onDelete: "cascade" }),
    workspaceId: varchar("workspace_id", { length: 64 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    blockId: varchar("block_id", { length: 128 }).notNull(),
    pageNumber: integer("page_number").notNull(),
    blockType: varchar("block_type", { length: 32 }).notNull(),
    canonicalStart: integer("canonical_start").notNull(),
    canonicalEnd: integer("canonical_end").notNull(),
    text: text("text").notNull(),
    confidence: varchar("confidence", { length: 16 }),
    isOcr: boolean("is_ocr").default(false).notNull(),
    boundingBoxJson: jsonb("bounding_box_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_source_blocks_version").on(table.documentVersionId),
    index("idx_source_blocks_offsets").on(table.documentVersionId, table.canonicalStart, table.canonicalEnd),
  ]
);

// Vector chunks for dense embedding retrieval
export const vectorChunks = pgTable(
  "vector_chunks",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    documentVersionId: varchar("document_version_id", { length: 64 })
      .notNull()
      .references(() => documentVersions.id, { onDelete: "cascade" }),
    workspaceId: varchar("workspace_id", { length: 64 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    headingContext: varchar("heading_context", { length: 255 }),
    canonicalStart: integer("canonical_start").notNull(),
    canonicalEnd: integer("canonical_end").notNull(),
    chunkText: text("chunk_text").notNull(),
    embedding: vector("embedding"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_vector_chunks_version").on(table.documentVersionId),
    index("idx_vector_chunks_workspace").on(table.workspaceId),
  ]
);

// Durable task queue with leasing and fencing tokens
export const analysisTasks = pgTable(
  "analysis_tasks",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 64 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    documentVersionId: varchar("document_version_id", { length: 64 })
      .notNull()
      .references(() => documentVersions.id, { onDelete: "cascade" }),
    comparisonVersionId: varchar("comparison_version_id", { length: 64 }),
    workflow: varchar("workflow", { length: 64 }).notNull(), // contract_review, contract_comparison, resume_intelligence, bullet_revision
    status: varchar("status", { length: 32 }).notNull().default("pending"), // pending, leased, running, completed, failed, canceled
    priority: integer("priority").default(0).notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    leaseWorkerId: varchar("lease_worker_id", { length: 128 }),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    fencingToken: integer("fencing_token").default(0).notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    nextAttemptAfter: timestamp("next_attempt_after", { withTimezone: true }).defaultNow().notNull(),
    lastError: text("last_error"),
    lastErrorCode: varchar("last_error_code", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_tasks_poll").on(table.status, table.nextAttemptAfter, table.priority),
    index("idx_tasks_version").on(table.documentVersionId),
    index("idx_tasks_workspace").on(table.workspaceId),
  ]
);

// Analysis runs: immutable execution records
export const analysisRuns = pgTable(
  "analysis_runs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    taskId: varchar("taskId", { length: 64 })
      .notNull()
      .references(() => analysisTasks.id, { onDelete: "cascade" }),
    workspaceId: varchar("workspace_id", { length: 64 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    documentVersionId: varchar("document_version_id", { length: 64 })
      .notNull()
      .references(() => documentVersions.id, { onDelete: "cascade" }),
    comparisonVersionId: varchar("comparison_version_id", { length: 64 }),
    workflow: varchar("workflow", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(), // completed, failed, canceled
    summaryJson: jsonb("summary_json").notNull(),
    modelMetadataJson: jsonb("model_metadata_json"),
    fencingToken: integer("fencing_token").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uniq_run_task").on(table.taskId),
    index("idx_runs_version").on(table.documentVersionId),
    index("idx_runs_workspace").on(table.workspaceId),
  ]
);

// Findings produced by analysis runs
export const findings = pgTable(
  "findings",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    runId: varchar("run_id", { length: 64 })
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    workspaceId: varchar("workspace_id", { length: 64 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    documentVersionId: varchar("document_version_id", { length: 64 })
      .notNull()
      .references(() => documentVersions.id, { onDelete: "cascade" }),
    workflow: varchar("workflow", { length: 64 }).notNull(),
    ruleId: varchar("rule_id", { length: 128 }),
    category: varchar("category", { length: 64 }).notNull(),
    severity: varchar("severity", { length: 32 }).notNull(), // critical, high, medium, low, info
    title: varchar("title", { length: 255 }).notNull(),
    explanation: text("explanation").notNull(),
    suggestedAction: text("suggested_action"),
    suggestedPatchJson: jsonb("suggested_patch_json"),
    confidence: varchar("confidence", { length: 32 }).notNull().default("high"),
    decisionState: varchar("decision_state", { length: 32 }).notNull().default("pending"), // pending, accepted, dismissed, modified
    decisionNote: text("decision_note"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: varchar("decided_by", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_findings_run").on(table.runId),
    index("idx_findings_version").on(table.documentVersionId),
    index("idx_findings_workspace").on(table.workspaceId),
    index("idx_findings_decision").on(table.workspaceId, table.decisionState),
  ]
);

// Citations linking findings to exact source blocks and spans
export const citations = pgTable(
  "citations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    findingId: varchar("finding_id", { length: 64 })
      .notNull()
      .references(() => findings.id, { onDelete: "cascade" }),
    workspaceId: varchar("workspace_id", { length: 64 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    documentVersionId: varchar("document_version_id", { length: 64 })
      .notNull()
      .references(() => documentVersions.id, { onDelete: "cascade" }),
    blockId: varchar("block_id", { length: 128 }).notNull(),
    pageNumber: integer("page_number").notNull(),
    canonicalStart: integer("canonical_start").notNull(),
    canonicalEnd: integer("canonical_end").notNull(),
    exactQuote: text("exact_quote").notNull(),
    confidence: varchar("confidence", { length: 16 }).notNull(),
    sourceType: varchar("source_type", { length: 32 }).notNull().default("digital_text"), // digital_text, ocr
    boundingBoxJson: jsonb("bounding_box_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_citations_finding").on(table.findingId),
    index("idx_citations_version").on(table.documentVersionId),
  ]
);

// Model invocations recording provider provenance, tokens, latency
export const modelInvocations = pgTable(
  "model_invocations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    runId: varchar("run_id", { length: 64 })
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    taskId: varchar("task_id", { length: 64 })
      .notNull()
      .references(() => analysisTasks.id, { onDelete: "cascade" }),
    workspaceId: varchar("workspace_id", { length: 64 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(), // local, hosted, recorded, deterministic
    modelName: varchar("model_name", { length: 128 }).notNull(),
    modelRevision: varchar("model_revision", { length: 128 }),
    promptHash: varchar("prompt_hash", { length: 64 }).notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms").notNull(),
    isLive: boolean("is_live").notNull(),
    isRecorded: boolean("is_recorded").notNull(),
    isDeterministic: boolean("is_deterministic").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_model_invocations_run").on(table.runId),
    index("idx_model_invocations_task").on(table.taskId),
  ]
);

// Append-only audit trail
export const auditEvents = pgTable(
  "audit_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 64 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorId: varchar("actor_id", { length: 64 }).notNull(),
    action: varchar("action", { length: 128 }).notNull(),
    targetType: varchar("target_type", { length: 64 }).notNull(),
    targetId: varchar("target_id", { length: 64 }).notNull(),
    metadataJson: jsonb("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_audit_workspace").on(table.workspaceId, table.createdAt),
    index("idx_audit_target").on(table.targetType, table.targetId),
  ]
);
