import pg from "pg";
import {
  TaskQueue,
  TaskRecord,
  ContentAddressedBlobStore,
  FilesystemBlobStore,
} from "@covenant/persistence";
import { DocumentIngestionEngine } from "@covenant/ingestion";
import { ContractReviewPipeline } from "@covenant/contract-pipeline";
import { ResumeIntelligencePipeline } from "@covenant/resume-pipeline";
import { HybridRetrievalEngine } from "@covenant/retrieval";
import { DocumentIR } from "@covenant/document-ir";
import crypto from "crypto";

export interface WorkerOptions {
  workerId?: string;
  pollIntervalMs?: number;
  heartbeatIntervalMs?: number;
  blobStore?: ContentAddressedBlobStore;
}

export class DurableTaskWorker {
  readonly workerId: string;
  private taskQueue: TaskQueue;
  private blobStore: ContentAddressedBlobStore;
  private ingestionEngine: DocumentIngestionEngine;
  private contractPipeline: ContractReviewPipeline;
  private resumePipeline: ResumeIntelligencePipeline;
  private retrievalEngine: HybridRetrievalEngine;
  private pool: pg.Pool;
  private pollIntervalMs: number;
  private heartbeatIntervalMs: number;
  private isRunning: boolean = false;
  private activeTaskPromise: Promise<void> | null = null;

  constructor(pool: pg.Pool, options?: WorkerOptions) {
    this.pool = pool;
    this.workerId = options?.workerId || `worker-${crypto.randomUUID()}`;
    this.pollIntervalMs = options?.pollIntervalMs ?? 1000;
    this.heartbeatIntervalMs = options?.heartbeatIntervalMs ?? 5000;
    this.blobStore = options?.blobStore || new FilesystemBlobStore("./data/blobs");

    this.taskQueue = new TaskQueue(pool);
    this.ingestionEngine = new DocumentIngestionEngine();
    this.contractPipeline = new ContractReviewPipeline();
    this.resumePipeline = new ResumeIntelligencePipeline();
    this.retrievalEngine = new HybridRetrievalEngine();
  }

  async start(): Promise<void> {
    this.isRunning = true;
    console.log(`[Worker] Started worker ${this.workerId}`);

    while (this.isRunning) {
      try {
        const task = await this.taskQueue.claimNextTask(this.workerId, 30000);

        if (task) {
          this.activeTaskPromise = this.processTask(task);
          await this.activeTaskPromise;
          this.activeTaskPromise = null;
        } else {
          await this.sleep(this.pollIntervalMs);
        }
      } catch (err) {
        if (this.isRunning) {
          console.error(`[Worker ${this.workerId}] Error in polling loop:`, err);
          await this.sleep(this.pollIntervalMs);
        }
      }
    }

    console.log(`[Worker] Worker ${this.workerId} exited polling loop.`);
  }

  async stop(): Promise<void> {
    console.log(`[Worker] Shutting down worker ${this.workerId}...`);
    this.isRunning = false;
    if (this.activeTaskPromise) {
      await this.activeTaskPromise;
    }
    console.log(`[Worker] Worker ${this.workerId} stopped cleanly.`);
  }

  async processTask(task: TaskRecord): Promise<void> {
    const { id: taskId, fencingToken, workflow, payload, workspaceId, documentVersionId } = task;
    console.log(`[Worker ${this.workerId}] Claimed task ${taskId} (${workflow}) with fencing token ${fencingToken}`);

    // Start heartbeat timer
    let heartbeatTimer: NodeJS.Timeout | null = setInterval(async () => {
      try {
        await this.taskQueue.renewLease(taskId, this.workerId, fencingToken, 30000);
      } catch (err) {
        console.warn(`[Worker ${this.workerId}] Heartbeat renewal failed for task ${taskId}:`, err);
      }
    }, this.heartbeatIntervalMs);

    try {
      // 1. Retrieve document content
      let fileBuffer: Buffer;
      let filename = (payload.filename as string) || "document.pdf";
      let mediaType = (payload.mediaType as string) || "application/pdf";

      if (payload.blobHash) {
        fileBuffer = await this.blobStore.get(payload.blobHash as string);
      } else if (payload.inlineBase64) {
        fileBuffer = Buffer.from(payload.inlineBase64 as string, "base64");
      } else if (payload.rawText) {
        fileBuffer = Buffer.from(payload.rawText as string, "utf-8");
        mediaType = "text/plain";
        filename = "document.txt";
      } else {
        throw new Error(`Task ${taskId} has no blobHash, inlineBase64, or rawText in payload.`);
      }

      // 2. Ingest document into DocumentIR
      const docIR = await this.ingestionEngine.ingest({
        buffer: fileBuffer,
        filename,
        mediaType,
      });

      // 3. Index document chunks in hybrid retrieval engine
      await this.retrievalEngine.indexDocument(docIR);

      // 4. Execute domain-specific pipeline
      let findings: any[] = [];
      let summary: Record<string, unknown> = {};

      if (workflow === "contract_review") {
        const contractResult = this.contractPipeline.analyzeContract(docIR, {
          playbookType: (payload.playbookType as string) || "nda",
        });
        findings = contractResult.findings;
        summary = contractResult.summary;
      } else if (workflow === "resume_intelligence") {
        const resumeResult = this.resumePipeline.analyzeResume(docIR, {
          jobDescription: payload.jobDescription as string | undefined,
        });
        findings = resumeResult.findings;
        summary = resumeResult.summary;
      } else {
        throw new Error(`Unsupported workflow: ${workflow}`);
      }

      // 5. Stop heartbeat
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }

      // 6. Atomically publish findings, citations, and mark task complete with fencing token check
      await this.taskQueue.publishTaskSuccess({
        taskId,
        workspaceId,
        documentVersionId,
        workflow,
        fencingToken,
        summary,
        findings: findings.map((f: any) => ({
          id: f.id,
          ruleId: f.ruleId,
          category: f.category,
          severity: f.severity,
          title: f.title,
          explanation: f.explanation,
          suggestedAction: f.suggestedAction,
          suggestedPatch: f.suggestedPatch,
          confidence: f.confidence,
          citations: (f.citations || []).map((c: any) => ({
            id: c.id,
            blockId: c.blockId,
            pageNumber: c.pageNumber,
            canonicalStart: c.startOffset,
            canonicalEnd: c.endOffset,
            exactQuote: c.exactQuote,
            confidence: String(c.confidence),
            sourceType: c.sourceType,
            boundingBox: c.boundingBox,
          })),
        })),
      });

      console.log(`[Worker ${this.workerId}] Completed task ${taskId} successfully with ${findings.length} findings.`);
    } catch (err: any) {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }

      console.error(`[Worker ${this.workerId}] Task ${taskId} failed:`, err);
      await this.taskQueue.recordTaskFailure({
        taskId,
        fencingToken,
        error: err instanceof Error ? err : new Error(String(err)),
        retryable: true,
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
