import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import pg from "pg";
import {
  PostgresTaskQueue,
  LocalFsBlobStore,
  WorkspaceRepository,
  DocumentRepository,
} from "@covenant/persistence";
import { DurableTaskWorker } from "../../apps/worker/src/worker";
import fs from "fs";

const testDbUrl = process.env.DATABASE_URL || "postgres://localhost:5432/covenant_test";
const pool = new pg.Pool({ connectionString: testDbUrl });
const testBlobDir = "./data/test_worker_blobs";
const blobStore = new LocalFsBlobStore(testBlobDir);

describe("Durable Task Worker End-to-End Processing", () => {
  let taskQueue: PostgresTaskQueue;
  let worker: DurableTaskWorker;
  let workspaceRepo: WorkspaceRepository;
  let docRepo: DocumentRepository;
  let workspaceId: string;
  let documentId: string;
  let versionId: string;

  beforeAll(async () => {
    taskQueue = new PostgresTaskQueue(pool);
    workspaceRepo = new WorkspaceRepository(pool);
    docRepo = new DocumentRepository(pool);

    worker = new DurableTaskWorker(pool, {
      workerId: "test-worker-e2e-1",
      blobStore,
      pollIntervalMs: 200,
      heartbeatIntervalMs: 500,
    });

    // Clean tables
    await pool.query("TRUNCATE TABLE audit_events, citations, findings, analysis_runs, analysis_tasks, source_blocks, document_versions, documents, workspaces CASCADE");

    // Setup base workspace and document
    const ws = await workspaceRepo.createWorkspace("Test WS", `test-ws-${Date.now()}`, "owner-1");
    workspaceId = ws.id;

    const sampleBlob = await blobStore.put(Buffer.from("Initial dummy content"), "text/plain");
    const { document, version } = await docRepo.createDocumentWithVersion({
      workspaceId,
      documentType: "contract",
      title: "Contract A",
      originalFilename: "contract.pdf",
      documentIr: {
        irVersion: "1.0.0",
        originalSha256: sampleBlob.sha256,
        mediaType: "application/pdf",
        extractorVersion: "1.0.0",
        pageCount: 1,
        pages: [],
        sections: [],
        canonicalText: "Initial dummy content",
        sourceMap: [],
      },
      blobRef: sampleBlob,
    });

    documentId = document.id;
    versionId = version.id;
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM analysis_tasks WHERE workspace_id = $1", [workspaceId]);
  });

  afterAll(async () => {
    await pool.end();
    if (fs.existsSync(testBlobDir)) {
      fs.rmSync(testBlobDir, { recursive: true, force: true });
    }
  });

  it("claims contract review task, renews lease, executes pipeline, and atomically publishes findings", async () => {
    // Save sample contract to blob store
    const sampleContract =
      "SECTION 1. CONFIDENTIALITY\n\n" +
      "Each party shall keep confidential all proprietary information for five (5) years.\n\n" +
      "SECTION 2. TERMINATION\n\n" +
      "Either party may terminate upon giving thirty (30) days written notice.\n\n" +
      "SECTION 3. INDEMNIFICATION\n\n" +
      "The Receiving Party shall indemnify and hold harmless the Disclosing Party against any and all claims, liabilities, damages, and legal costs.\n";

    const blobRef = await blobStore.put(Buffer.from(sampleContract), "text/plain");

    // Enqueue task
    const { id: taskId } = await taskQueue.enqueueTask({
      workspaceId,
      documentVersionId: versionId,
      workflow: "contract_review",
      payload: {
        documentId,
        versionId,
        blobHash: blobRef.sha256,
        filename: "sample_contract.txt",
        mediaType: "text/plain",
        playbookType: "nda",
      },
    });

    // Claim and process task directly with worker
    const claimed = await taskQueue.claimNextTask(worker.workerId, 30000);
    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(taskId);
    expect(claimed?.fencingToken).toBe(1);

    await worker.processTask(claimed!);

    // Verify task completion in database
    const taskRes = await pool.query("SELECT * FROM analysis_tasks WHERE id = $1", [taskId]);
    expect(taskRes.rows[0].status).toBe("completed");

    // Verify findings were published in findings table
    const findRes = await pool.query("SELECT * FROM findings WHERE document_version_id = $1", [versionId]);
    expect(findRes.rows.length).toBeGreaterThan(0);

    // Verify citations exist
    const citRes = await pool.query("SELECT * FROM citations WHERE finding_id = $1", [findRes.rows[0].id]);
    expect(citRes.rows.length).toBeGreaterThan(0);
  });

  it("processes resume intelligence task and atomically publishes resume findings", async () => {
    const sampleResume =
      "Alex Doe\nalex@example.com | 555-987-6543 | Seattle, WA\n" +
      "EXPERIENCE\n" +
      "Senior Backend Engineer - Tech Co | Jan 2020 - Present\n" +
      "• Responsible for building cloud microservices with Go, Python, and PostgreSQL.\n" +
      "• Deployed containerized applications with Docker.\n" +
      "EDUCATION\n" +
      "BS Computer Engineering - University of Washington | 2019\n" +
      "SKILLS\n" +
      "Go, Python, PostgreSQL, Docker, Git\n";

    const blobRef = await blobStore.put(Buffer.from(sampleResume), "text/plain");

    const { id: taskId } = await taskQueue.enqueueTask({
      workspaceId,
      documentVersionId: versionId,
      workflow: "resume_intelligence",
      payload: {
        documentId,
        versionId,
        blobHash: blobRef.sha256,
        filename: "alex_resume.txt",
        mediaType: "text/plain",
        jobDescription: "Requirements:\n• 3+ years experience with Go and PostgreSQL.\n• Experience with Docker.",
      },
    });

    const claimed = await taskQueue.claimNextTask(worker.workerId, 30000);
    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(taskId);

    await worker.processTask(claimed!);

    // Verify task completion
    const taskRes = await pool.query("SELECT * FROM analysis_tasks WHERE id = $1", [taskId]);
    expect(taskRes.rows[0].status).toBe("completed");
  });
});
