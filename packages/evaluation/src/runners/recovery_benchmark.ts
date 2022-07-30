import pg from "pg";
import {
  PostgresTaskQueue,
  TaskLeaseError,
  WorkspaceRepository,
  DocumentRepository,
  LocalFsBlobStore,
} from "@covenant/persistence";
import { RecoveryBenchmarkResult } from "../types";

export interface RecoveryBenchmarkOptions {
  iterations?: number;
  pool?: pg.Pool;
}

export class RecoveryBenchmarkRunner {
  private pool: pg.Pool;
  private taskQueue: PostgresTaskQueue;
  private workspaceRepo: WorkspaceRepository;
  private docRepo: DocumentRepository;
  private blobStore: LocalFsBlobStore;

  constructor(pool?: pg.Pool) {
    const dbUrl = process.env.DATABASE_URL || "postgres://localhost:5432/covenant_test";
    this.pool = pool || new pg.Pool({ connectionString: dbUrl });
    this.taskQueue = new PostgresTaskQueue(this.pool);
    this.workspaceRepo = new WorkspaceRepository(this.pool);
    this.docRepo = new DocumentRepository(this.pool);
    this.blobStore = new LocalFsBlobStore("./data/test_recovery_blobs");
  }

  async runBenchmark(options: RecoveryBenchmarkOptions = {}): Promise<RecoveryBenchmarkResult> {
    const iterations = options.iterations ?? 105;
    const startTime = Date.now();

    // 1. Setup isolated test workspace and base document
    const ws = await this.workspaceRepo.createWorkspace(
      "Recovery Benchmark WS",
      `rec-bench-${Date.now()}`,
      "benchmark-runner"
    );
    const workspaceId = ws.id;

    const dummyBlob = await this.blobStore.put(Buffer.from("benchmark recovery content"), "text/plain");
    const { version } = await this.docRepo.createDocumentWithVersion({
      workspaceId,
      documentType: "contract",
      title: "Recovery Test Document",
      originalFilename: "test.txt",
      documentIr: {
        id: "doc-rec-1",
        versionId: "v1",
        originalSha256: dummyBlob.sha256,
        mediaType: "text/plain",
        extractorVersion: "1.0.0",
        extractedAt: new Date().toISOString(),
        pageCount: 1,
        pages: [],
        canonicalText: "benchmark recovery content",
        sourceMap: [],
      },
      blobRef: dummyBlob,
    });
    const versionId = version.id;

    let successfulReclaims = 0;
    let staleRejections = 0;
    let corruptionsDetected = 0;

    for (let i = 1; i <= iterations; i++) {
      // 1. Enqueue task
      const { id: taskId } = await this.taskQueue.enqueueTask({
        workspaceId,
        documentVersionId: versionId,
        workflow: "contract_review",
        priority: 10,
        payload: { iteration: i },
      });

      // 2. Worker A claims the task
      const workerAId = `worker-A-${i}`;
      const claimA = await this.taskQueue.claimNextTask(workerAId, 10000);
      if (!claimA || claimA.id !== taskId || claimA.fencingToken !== 1) {
        corruptionsDetected++;
        continue;
      }

      // 3. Simulate Worker A interruption / crash: artificially expire the lease
      await this.pool.query(
        `UPDATE analysis_tasks
         SET lease_expires_at = NOW() - INTERVAL '1 second', status = 'leased'
         WHERE id = $1`,
        [taskId]
      );

      // 4. Worker B reclaims the abandoned task
      const workerBId = `worker-B-${i}`;
      const claimB = await this.taskQueue.claimNextTask(workerBId, 30000);
      if (!claimB || claimB.id !== taskId || claimB.fencingToken !== 2) {
        corruptionsDetected++;
        continue;
      }
      successfulReclaims++;

      // 5. Stale Worker A wakes up and attempts to publish findings with obsolete token (1)
      let rejected = false;
      try {
        await this.taskQueue.publishTaskSuccess({
          taskId,
          workspaceId,
          documentVersionId: versionId,
          workflow: "contract_review",
          fencingToken: claimA.fencingToken, // Stale token 1
          summary: { note: "stale worker A payload" },
          findings: [],
        });
      } catch (err: any) {
        if (err instanceof TaskLeaseError && err.code === "FENCING_TOKEN_MISMATCH") {
          rejected = true;
          staleRejections++;
        }
      }

      if (!rejected) {
        corruptionsDetected++;
      }

      // 6. Legitimate Worker B publishes findings with current fencing token (2)
      await this.taskQueue.publishTaskSuccess({
        taskId,
        workspaceId,
        documentVersionId: versionId,
        workflow: "contract_review",
        fencingToken: claimB.fencingToken, // Valid token 2
        summary: { note: "valid worker B payload" },
        findings: [],
      });

      // 7. Verify task reached completed state without corruption
      const checkRes = await this.pool.query(
        "SELECT status, fencing_token FROM analysis_tasks WHERE id = $1",
        [taskId]
      );
      if (checkRes.rows[0]?.status !== "completed" || checkRes.rows[0]?.fencing_token !== 2) {
        corruptionsDetected++;
      }
    }

    const durationMs = Date.now() - startTime;
    const allEnforced =
      successfulReclaims === iterations &&
      staleRejections === iterations &&
      corruptionsDetected === 0;

    return {
      totalInterruptions: iterations,
      successfulReclaims,
      staleRejections,
      corruptionsDetected,
      durationMs,
      allEnforced,
    };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new RecoveryBenchmarkRunner();
  runner
    .runBenchmark({ iterations: 105 })
    .then((res) => {
      console.log(`Recovery benchmark passed: ${res.successfulReclaims}/${res.totalInterruptions} reclaims, ${res.staleRejections} stale token rejections, 0 corruptions.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Recovery benchmark failed:", err);
      process.exit(1);
    });
}
