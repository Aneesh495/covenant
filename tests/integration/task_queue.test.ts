import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  PostgresTaskQueue,
  WorkspaceRepository,
  DocumentRepository,
  FindingRepository,
  LocalFsBlobStore,
  runMigrations,
  getPgPool,
  closeDatabase,
} from "@covenant/persistence";
import { buildCanonicalDocument } from "@covenant/document-ir";
import { TaskLeaseError } from "@covenant/shared";
import crypto from "crypto";

describe("PostgreSQL Durable Task Queue and Tenant Isolation", () => {
  let queue: PostgresTaskQueue;
  let wsRepo: WorkspaceRepository;
  let docRepo: DocumentRepository;
  let findingRepo: FindingRepository;
  let blobStore: LocalFsBlobStore;

  let workspaceAId: string;
  let workspaceBId: string;
  let docVersionAId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/covenant_test";
    await runMigrations();

    const pool = getPgPool();
    queue = new PostgresTaskQueue(pool);
    wsRepo = new WorkspaceRepository(pool);
    docRepo = new DocumentRepository(pool);
    findingRepo = new FindingRepository(pool);
    blobStore = new LocalFsBlobStore("tmp/test-queue-blobs");

    // Create two isolated workspaces
    const wsA = await wsRepo.createWorkspace("Alpha Corp", `alpha-${Date.now()}`, "user-alpha");
    const wsB = await wsRepo.createWorkspace("Beta Inc", `beta-${Date.now()}`, "user-beta");
    workspaceAId = wsA.id;
    workspaceBId = wsB.id;

    // Create a document in Workspace A
    const rawContent = Buffer.from("Master Services Agreement between Alpha and Contractor.");
    const blobRef = await blobStore.put(rawContent, "text/plain");

    const canonicalBuild = buildCanonicalDocument([
      {
        pageNumber: 1,
        width: 612,
        height: 792,
        isOcr: false,
        rawBlocks: [
          {
            id: "b1",
            type: "paragraph",
            text: "Master Services Agreement between Alpha and Contractor.",
            readingOrderIndex: 0,
            confidence: 1.0,
            isOcr: false,
          },
        ],
      },
    ]);

    const docResult = await docRepo.createDocumentWithVersion({
      workspaceId: workspaceAId,
      documentType: "contract",
      title: "Alpha Agreement",
      originalFilename: "agreement.txt",
      blobRef,
      documentIr: {
        id: "doc-test-1",
        versionId: "ver-test-1",
        originalSha256: blobRef.sha256,
        mediaType: "text/plain",
        extractorVersion: "2.0.0",
        extractedAt: new Date().toISOString(),
        pageCount: 1,
        pages: canonicalBuild.pages,
        canonicalText: canonicalBuild.canonicalText,
        sourceMap: canonicalBuild.sourceMap,
      },
    });

    docVersionAId = docResult.version.id;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("enqueues task and claims it using SKIP LOCKED with fencing token", async () => {
    const { id: taskId } = await queue.enqueueTask({
      workspaceId: workspaceAId,
      documentVersionId: docVersionAId,
      workflow: "contract_review",
      payload: { mode: "deep_audit" },
      priority: 10,
    });

    const claimed = await queue.claimNextTask("worker-1", 30000);
    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(taskId);
    expect(claimed?.fencingToken).toBe(1);
    expect(claimed?.leaseWorkerId).toBe("worker-1");

    // Second worker should not be able to claim the same active task
    const claimedAgain = await queue.claimNextTask("worker-2", 30000);
    expect(claimedAgain).toBeNull();
  });

  it("renews lease heartbeat successfully", async () => {
    const { id: taskId } = await queue.enqueueTask({
      workspaceId: workspaceAId,
      documentVersionId: docVersionAId,
      workflow: "contract_review",
      payload: { mode: "deep_audit" },
    });

    const claimed = await queue.claimNextTask("worker-hb", 10000);
    expect(claimed).not.toBeNull();

    const renewed = await queue.renewLease(taskId, "worker-hb", claimed!.fencingToken, 60000);
    expect(renewed).toBe(true);
  });

  it("rejects publication from stale worker when fencing token mismatches", async () => {
    const { id: taskId } = await queue.enqueueTask({
      workspaceId: workspaceAId,
      documentVersionId: docVersionAId,
      workflow: "contract_review",
      payload: { test: true },
    });

    // Worker 1 claims task with short lease (1ms)
    const claimedWorker1 = await queue.claimNextTask("worker-stale", 1);
    expect(claimedWorker1).not.toBeNull();
    const staleFencingToken = claimedWorker1!.fencingToken; // token 1

    // Wait 5ms for lease to expire
    await new Promise((r) => setTimeout(r, 10));

    // Worker 2 claims expired task, incrementing fencing token to 2
    const claimedWorker2 = await queue.claimNextTask("worker-fresh", 30000);
    expect(claimedWorker2).not.toBeNull();
    expect(claimedWorker2?.id).toBe(taskId);
    expect(claimedWorker2?.fencingToken).toBe(staleFencingToken + 1);

    // Stale Worker 1 attempts to publish with token 1: MUST fail with FENCING_TOKEN_MISMATCH
    await expect(
      queue.publishTaskSuccess({
        taskId,
        workspaceId: workspaceAId,
        documentVersionId: docVersionAId,
        workflow: "contract_review",
        fencingToken: staleFencingToken,
        summary: { risk: "high" },
        findings: [],
      })
    ).rejects.toThrow(TaskLeaseError);
  });

  it("atomically publishes findings, citations, and marks task complete", async () => {
    const { id: taskId } = await queue.enqueueTask({
      workspaceId: workspaceAId,
      documentVersionId: docVersionAId,
      workflow: "contract_review",
      payload: { test: true },
    });

    const claimed = await queue.claimNextTask("worker-pub", 30000);
    expect(claimed).not.toBeNull();

    const findingId = `f-${crypto.randomUUID()}`;
    const citationId = `c-${crypto.randomUUID()}`;

    const { runId } = await queue.publishTaskSuccess({
      taskId,
      workspaceId: workspaceAId,
      documentVersionId: docVersionAId,
      workflow: "contract_review",
      fencingToken: claimed!.fencingToken,
      summary: {
        overallRiskLevel: "high",
        criticalIssues: ["Unlimited liability exposure"],
      },
      findings: [
        {
          id: findingId,
          ruleId: "RULE_LIABILITY_UNCAPPED",
          category: "liability",
          severity: "high",
          title: "Uncapped liability",
          explanation: "No limitation of liability found in agreement.",
          confidence: "high",
          citations: [
            {
              id: citationId,
              blockId: "b1",
              pageNumber: 1,
              canonicalStart: 0,
              canonicalEnd: 25,
              exactQuote: "Master Services Agreement",
              confidence: "1.0",
              sourceType: "digital_text",
            },
          ],
        },
      ],
    });

    expect(runId).toBeDefined();

    // Query findings via findingRepo in Workspace A
    const findingsA = await findingRepo.listFindingsForRun(workspaceAId, runId);
    expect(findingsA.length).toBe(1);
    expect(findingsA[0].id).toBe(findingId);
    expect(findingsA[0].citations.length).toBe(1);
    expect(findingsA[0].citations[0].exactQuote).toBe("Master Services Agreement");

    // Tenant isolation check: Workspace B CANNOT view Workspace A findings or runs
    const findingsB = await findingRepo.listFindingsForRun(workspaceBId, runId);
    expect(findingsB.length).toBe(0);

    const docB = await docRepo.getDocument(workspaceBId, docVersionAId);
    expect(docB).toBeNull();
  });
});
