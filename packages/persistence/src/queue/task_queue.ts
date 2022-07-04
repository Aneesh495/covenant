import { Pool, PoolClient } from "pg";
import { getPgPool } from "../connection";
import { TaskLeaseError, CovenantError } from "@covenant/shared";
import crypto from "crypto";

export interface EnqueueTaskParams {
  workspaceId: string;
  documentVersionId: string;
  comparisonVersionId?: string;
  workflow: string;
  priority?: number;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}

export interface ClaimedTask {
  id: string;
  workspaceId: string;
  documentVersionId: string;
  comparisonVersionId?: string;
  workflow: string;
  priority: number;
  payload: Record<string, unknown>;
  fencingToken: number;
  attempts: number;
  leaseWorkerId: string;
  leaseExpiresAt: Date;
}

export interface PublishTaskSuccessParams {
  taskId: string;
  workspaceId: string;
  documentVersionId: string;
  comparisonVersionId?: string;
  workflow: string;
  fencingToken: number;
  summary: Record<string, unknown>;
  modelMetadata?: Record<string, unknown>;
  findings: Array<{
    id: string;
    ruleId?: string;
    category: string;
    severity: string;
    title: string;
    explanation: string;
    suggestedAction?: string;
    suggestedPatch?: Record<string, unknown>;
    confidence: string;
    citations: Array<{
      id: string;
      blockId: string;
      pageNumber: number;
      canonicalStart: number;
      canonicalEnd: number;
      exactQuote: string;
      confidence: string;
      sourceType: string;
      boundingBox?: Record<string, unknown>;
    }>;
  }>;
  modelInvocation?: {
    provider: string;
    modelName: string;
    modelRevision?: string;
    promptHash: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs: number;
    isLive: boolean;
    isRecorded: boolean;
    isDeterministic: boolean;
  };
}

export interface RecordTaskFailureParams {
  taskId: string;
  fencingToken: number;
  error: Error | CovenantError;
  retryable: boolean;
}

export class PostgresTaskQueue {
  private readonly pool: Pool;

  constructor(pool: Pool = getPgPool()) {
    this.pool = pool;
  }

  async enqueueTask(params: EnqueueTaskParams): Promise<{ id: string }> {
    const id = `task-${crypto.randomUUID()}`;
    const priority = params.priority ?? 0;
    const maxAttempts = params.maxAttempts ?? 3;

    const query = `
      INSERT INTO analysis_tasks (
        id, workspace_id, document_version_id, comparison_version_id,
        workflow, status, priority, payload_json, max_attempts,
        next_attempt_after, attempts, fencing_token, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, NOW(), 0, 0, NOW(), NOW())
      RETURNING id;
    `;

    const { rows } = await this.pool.query(query, [
      id,
      params.workspaceId,
      params.documentVersionId,
      params.comparisonVersionId || null,
      params.workflow,
      priority,
      JSON.stringify(params.payload),
      maxAttempts,
    ]);

    return { id: rows[0].id };
  }

  async claimNextTask(workerId: string, leaseDurationMs: number = 60000): Promise<ClaimedTask | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Claim a pending or expired task with FOR UPDATE SKIP LOCKED
      const selectQuery = `
        SELECT id, workspace_id, document_version_id, comparison_version_id,
               workflow, priority, payload_json, attempts, max_attempts, fencing_token
        FROM analysis_tasks
        WHERE (status = 'pending' OR (status IN ('leased', 'running') AND lease_expires_at < NOW()))
          AND next_attempt_after <= NOW()
          AND attempts < max_attempts
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;
      `;

      const { rows } = await client.query(selectQuery);
      if (rows.length === 0) {
        await client.query("COMMIT");
        return null;
      }

      const task = rows[0];
      const newFencingToken = task.fencing_token + 1;
      const newAttempts = task.attempts + 1;
      const leaseExpiresAt = new Date(Date.now() + leaseDurationMs);

      const updateQuery = `
        UPDATE analysis_tasks
        SET status = 'leased',
            lease_worker_id = $1,
            lease_expires_at = $2,
            fencing_token = $3,
            attempts = $4,
            updated_at = NOW()
        WHERE id = $5;
      `;

      await client.query(updateQuery, [
        workerId,
        leaseExpiresAt,
        newFencingToken,
        newAttempts,
        task.id,
      ]);

      await client.query("COMMIT");

      return {
        id: task.id,
        workspaceId: task.workspace_id,
        documentVersionId: task.document_version_id,
        comparisonVersionId: task.comparison_version_id || undefined,
        workflow: task.workflow,
        priority: task.priority,
        payload: task.payload_json,
        fencingToken: newFencingToken,
        attempts: newAttempts,
        leaseWorkerId: workerId,
        leaseExpiresAt,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async renewLease(
    taskId: string,
    workerId: string,
    fencingToken: number,
    extensionMs: number = 60000
  ): Promise<boolean> {
    const newExpiresAt = new Date(Date.now() + extensionMs);
    const query = `
      UPDATE analysis_tasks
      SET lease_expires_at = $1,
          status = 'running',
          updated_at = NOW()
      WHERE id = $2
        AND lease_worker_id = $3
        AND fencing_token = $4
        AND status IN ('leased', 'running');
    `;

    const result = await this.pool.query(query, [newExpiresAt, taskId, workerId, fencingToken]);
    return (result.rowCount ?? 0) > 0;
  }

  async publishTaskSuccess(params: PublishTaskSuccessParams): Promise<{ runId: string }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Verify fencing token under row lock
      const checkQuery = `
        SELECT fencing_token, status, attempts
        FROM analysis_tasks
        WHERE id = $1
        FOR UPDATE;
      `;

      const { rows } = await client.query(checkQuery, [params.taskId]);
      if (rows.length === 0) {
        throw new TaskLeaseError("Task not found during publication boundary", "LEASE_EXPIRED");
      }

      const current = rows[0];
      if (current.fencing_token !== params.fencingToken) {
        throw new TaskLeaseError(
          `Fencing token mismatch: expected token ${params.fencingToken} but task has token ${current.fencing_token}. A newer lease has replaced this worker.`,
          "FENCING_TOKEN_MISMATCH"
        );
      }

      if (current.status === "completed") {
        // Idempotent return if already published
        const runRes = await client.query("SELECT id FROM analysis_runs WHERE task_id = $1", [params.taskId]);
        await client.query("COMMIT");
        return { runId: runRes.rows[0]?.id || `run-${params.taskId}` };
      }

      // Create analysis run
      const runId = `run-${crypto.randomUUID()}`;
      const insertRunQuery = `
        INSERT INTO analysis_runs (
          id, task_id, workspace_id, document_version_id, comparison_version_id,
          workflow, status, summary_json, model_metadata_json, fencing_token,
          published_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, $8, $9, NOW(), NOW())
        RETURNING id;
      `;

      await client.query(insertRunQuery, [
        runId,
        params.taskId,
        params.workspaceId,
        params.documentVersionId,
        params.comparisonVersionId || null,
        params.workflow,
        JSON.stringify(params.summary),
        params.modelMetadata ? JSON.stringify(params.modelMetadata) : null,
        params.fencingToken,
      ]);

      // Insert findings and citations
      for (const finding of params.findings) {
        const insertFindingQuery = `
          INSERT INTO findings (
            id, run_id, workspace_id, document_version_id, workflow,
            rule_id, category, severity, title, explanation,
            suggested_action, suggested_patch_json, confidence,
            decision_state, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', NOW());
        `;

        await client.query(insertFindingQuery, [
          finding.id,
          runId,
          params.workspaceId,
          params.documentVersionId,
          params.workflow,
          finding.ruleId || null,
          finding.category,
          finding.severity,
          finding.title,
          finding.explanation,
          finding.suggestedAction || null,
          finding.suggestedPatch ? JSON.stringify(finding.suggestedPatch) : null,
          finding.confidence,
        ]);

        for (const citation of finding.citations) {
          const insertCitationQuery = `
            INSERT INTO citations (
              id, finding_id, workspace_id, document_version_id,
              block_id, page_number, canonical_start, canonical_end,
              exact_quote, confidence, source_type, bounding_box_json, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW());
          `;

          await client.query(insertCitationQuery, [
            citation.id,
            finding.id,
            params.workspaceId,
            params.documentVersionId,
            citation.blockId,
            citation.pageNumber,
            citation.canonicalStart,
            citation.canonicalEnd,
            citation.exactQuote,
            citation.confidence,
            citation.sourceType,
            citation.boundingBox ? JSON.stringify(citation.boundingBox) : null,
          ]);
        }
      }

      // Record model invocation provenance if present
      if (params.modelInvocation) {
        const invId = `inv-${crypto.randomUUID()}`;
        const insertInvQuery = `
          INSERT INTO model_invocations (
            id, run_id, task_id, workspace_id, provider,
            model_name, model_revision, prompt_hash,
            input_tokens, output_tokens, latency_ms,
            is_live, is_recorded, is_deterministic, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW());
        `;

        await client.query(insertInvQuery, [
          invId,
          runId,
          params.taskId,
          params.workspaceId,
          params.modelInvocation.provider,
          params.modelInvocation.modelName,
          params.modelInvocation.modelRevision || null,
          params.modelInvocation.promptHash,
          params.modelInvocation.inputTokens || null,
          params.modelInvocation.outputTokens || null,
          params.modelInvocation.latencyMs,
          params.modelInvocation.isLive,
          params.modelInvocation.isRecorded,
          params.modelInvocation.isDeterministic,
        ]);
      }

      // Mark task completed and release lease
      const updateTaskQuery = `
        UPDATE analysis_tasks
        SET status = 'completed',
            lease_worker_id = NULL,
            lease_expires_at = NULL,
            updated_at = NOW()
        WHERE id = $1;
      `;

      await client.query(updateTaskQuery, [params.taskId]);

      await client.query("COMMIT");
      return { runId };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async recordTaskFailure(params: RecordTaskFailureParams): Promise<void> {
    const errorCode = params.error instanceof CovenantError ? params.error.code : "INTERNAL_ERROR";
    const errorMessage = params.error.message.slice(0, 1000);

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const checkQuery = `
        SELECT attempts, max_attempts, fencing_token
        FROM analysis_tasks
        WHERE id = $1
        FOR UPDATE;
      `;

      const { rows } = await client.query(checkQuery, [params.taskId]);
      if (rows.length === 0) {
        await client.query("ROLLBACK");
        return;
      }

      const task = rows[0];
      if (task.fencing_token !== params.fencingToken) {
        // Newer lease already claimed; do not overwrite state
        await client.query("ROLLBACK");
        return;
      }

      const shouldRetry = params.retryable && task.attempts < task.max_attempts;

      if (shouldRetry) {
        // Exponential backoff: 2^attempts * 2 seconds + jitter
        const backoffSeconds = Math.min(300, Math.pow(2, task.attempts) * 2 + Math.floor(Math.random() * 3));
        const retryQuery = `
          UPDATE analysis_tasks
          SET status = 'pending',
              lease_worker_id = NULL,
              lease_expires_at = NULL,
              next_attempt_after = NOW() + ($1 || ' seconds')::interval,
              last_error = $2,
              last_error_code = $3,
              updated_at = NOW()
          WHERE id = $4;
        `;
        await client.query(retryQuery, [backoffSeconds, errorMessage, errorCode, params.taskId]);
      } else {
        const failQuery = `
          UPDATE analysis_tasks
          SET status = 'failed',
              lease_worker_id = NULL,
              lease_expires_at = NULL,
              last_error = $1,
              last_error_code = $2,
              updated_at = NOW()
          WHERE id = $3;
        `;
        await client.query(failQuery, [errorMessage, errorCode, params.taskId]);
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
