import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import pg from "pg";
import { registerApiRoutes } from "../../apps/api/src/routes";
import { LocalFsBlobStore } from "@covenant/persistence";
import fs from "fs";

const testDbUrl = process.env.DATABASE_URL || "postgres://localhost:5432/covenant_test";
const pool = new pg.Pool({ connectionString: testDbUrl });
const testBlobDir = "./data/test_api_blobs";
const blobStore = new LocalFsBlobStore(testBlobDir);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: "test-secret",
    resave: false,
    saveUninitialized: true,
  })
);

registerApiRoutes(app, { pool, blobStore });

describe("Authenticated Workspace API Routes", () => {
  const client = request.agent(app);
  let createdDocumentId: string;
  let createdVersionId: string;
  let createdTaskId: string;
  let secondDocId: string;

  beforeAll(async () => {
    // Truncate tables for clean test state
    await pool.query("TRUNCATE TABLE audit_events, citations, findings, analysis_runs, analysis_tasks, source_blocks, document_versions, documents, workspaces CASCADE");
  });

  afterAll(async () => {
    await pool.end();
    if (fs.existsSync(testBlobDir)) {
      fs.rmSync(testBlobDir, { recursive: true, force: true });
    }
  });

  it("uploads contract document, validates magic signature, persists blob and enqueues durable task", async () => {
    const contractText =
      "MUTUAL NON-DISCLOSURE AGREEMENT\n\n" +
      "This Mutual Non-Disclosure Agreement governs confidential information disclosed by Alpha to Beta.\n\n" +
      "SECTION 1. TERMINATION\n\n" +
      "Either party may terminate upon giving thirty (30) days written notice.\n\n" +
      "SECTION 2. INDEMNIFICATION\n\n" +
      "The Receiving Party shall indemnify and hold harmless the Disclosing Party against any and all liabilities.\n";

    const res = await client
      .post("/api/documents/upload")
      .field("documentType", "contract")
      .field("playbookType", "nda")
      .attach("document", Buffer.from(contractText), "mutual_nda.txt");

    expect(res.status).toBe(201);
    expect(res.body.documentId).toBeDefined();
    expect(res.body.versionId).toBeDefined();
    expect(res.body.taskId).toBeDefined();
    expect(res.body.status).toBe("pending");

    createdDocumentId = res.body.documentId;
    createdVersionId = res.body.versionId;
    createdTaskId = res.body.taskId;

    // Verify task in database
    const taskRes = await pool.query("SELECT * FROM analysis_tasks WHERE id = $1", [createdTaskId]);
    expect(taskRes.rows.length).toBe(1);
    expect(taskRes.rows[0].workflow).toBe("contract_review");
    expect(taskRes.rows[0].status).toBe("pending");
  });

  it("retrieves durable task status via GET /api/tasks/:id", async () => {
    const res = await client.get(`/api/tasks/${createdTaskId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdTaskId);
    expect(res.body.workflow).toBe("contract_review");
    expect(res.body.status).toBe("pending");
  });

  it("lists workspace documents via GET /api/documents", async () => {
    const res = await client.get("/api/documents");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].document_type).toBe("contract");
  });

  it("retrieves document details and latest version via GET /api/documents/:id", async () => {
    const res = await client.get(`/api/documents/${createdDocumentId}`);
    expect(res.status).toBe(200);
    expect(res.body.document.id).toBe(createdDocumentId);
    expect(res.body.latestVersion).toBeDefined();
    expect(res.body.latestVersion.canonicalText || res.body.latestVersion.canonical_text).toBeDefined();
  });

  it("retrieves full DocumentIR via GET /api/documents/:id/ir", async () => {
    const res = await client.get(`/api/documents/${createdDocumentId}/ir`);
    expect(res.status).toBe(200);
    expect(res.body.extractorVersion || res.body.irVersion).toBeDefined();
    expect(res.body.canonicalText).toBeDefined();
    expect(Array.isArray(res.body.pages)).toBe(true);
    expect(Array.isArray(res.body.sourceMap)).toBe(true);
  });

  it("records reviewer triage decision and appends audit event", async () => {
    // Insert test run and finding
    const runId = `run-test-${Date.now()}`;
    await pool.query(
      `INSERT INTO analysis_runs (id, task_id, workspace_id, document_version_id, workflow, status, summary_json, fencing_token)
       VALUES ($1, $2, (SELECT workspace_id FROM documents WHERE id = $3), $4, 'contract_review', 'completed', '{}', 1)`,
      [runId, createdTaskId, createdDocumentId, createdVersionId]
    );

    const findingId = `find-test-${Date.now()}`;
    await pool.query(
      `INSERT INTO findings (id, run_id, workspace_id, document_version_id, workflow, category, severity, title, explanation, decision_state)
       VALUES ($1, $2, (SELECT workspace_id FROM documents WHERE id = $3), $4, 'contract_review', 'termination', 'medium', 'Notice Period Review', 'Verified notice period.', 'pending')`,
      [findingId, runId, createdDocumentId, createdVersionId]
    );

    // PATCH decision to accepted
    const patchRes = await client
      .patch(`/api/findings/${findingId}/decision`)
      .send({
        decisionState: "accepted",
        reviewerNotes: "Approved by legal counsel.",
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.decision_state).toBe("accepted");
    expect(patchRes.body.reviewer_notes).toBe("Approved by legal counsel.");

    // Verify append-only audit event
    const auditRes = await pool.query(
      "SELECT * FROM audit_events WHERE target_id = $1 AND action = 'finding_decision'",
      [findingId]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].metadata_json.decisionState).toBe("accepted");
  });

  it("compares two document versions via POST /api/documents/compare", async () => {
    // Upload second version with modified notice period
    const contractText2 =
      "MUTUAL NON-DISCLOSURE AGREEMENT\n\n" +
      "This Mutual Non-Disclosure Agreement governs confidential information disclosed by Alpha to Beta.\n\n" +
      "SECTION 1. TERMINATION\n\n" +
      "Either party may terminate upon giving fourteen (14) days written notice.\n\n" +
      "SECTION 2. INDEMNIFICATION\n\n" +
      "The Receiving Party shall indemnify and hold harmless the Disclosing Party against any and all liabilities.\n";

    const uploadRes = await client
      .post("/api/documents/upload")
      .field("documentType", "contract")
      .attach("document", Buffer.from(contractText2), "mutual_nda_v2.txt");

    secondDocId = uploadRes.body.documentId;

    const compareRes = await client
      .post("/api/documents/compare")
      .send({
        baseDocumentId: createdDocumentId,
        targetDocumentId: secondDocId,
      });

    expect(compareRes.status).toBe(200);
    expect(compareRes.body.alignments).toBeDefined();
    expect(compareRes.body.summary).toBeDefined();
    expect(compareRes.body.summary.totalClausesBase).toBeGreaterThan(0);
  });

  it("matches candidate resume against job requirements via POST /api/resumes/:id/match", async () => {
    // Upload candidate resume
    const resumeText =
      "Jane Doe\n\n" +
      "jane@example.com | 555-123-4567 | San Francisco, CA\n\n" +
      "PROFESSIONAL SUMMARY\n\n" +
      "Senior Software Engineer with deep expertise in distributed systems, TypeScript, Python, and cloud infrastructure.\n\n" +
      "EXPERIENCE\n\n" +
      "Staff Engineer - Cloud Corp | Jan 2019 - Present\n\n" +
      "• Architected distributed systems handling 50,000 QPS with TypeScript, Python, and PostgreSQL.\n\n" +
      "• Deployed microservices on Kubernetes and AWS.\n\n" +
      "EDUCATION\n\n" +
      "University of California, Berkeley\n\n" +
      "Bachelor of Science in Computer Science | 2018\n\n" +
      "TECHNICAL SKILLS\n\n" +
      "Languages: TypeScript, JavaScript, Python, Go, SQL\n\n" +
      "Infrastructure: Docker, Kubernetes, AWS, PostgreSQL, Redis, Git\n";

    const uploadRes = await client
      .post("/api/documents/upload")
      .field("documentType", "resume")
      .attach("document", Buffer.from(resumeText), "jane_resume.txt");

    const resumeDocId = uploadRes.body.documentId;

    const matchRes = await client
      .post(`/api/resumes/${resumeDocId}/match`)
      .send({
        jobDescription:
          "Requirements:\n• 4+ years software engineering experience.\n• Proficiency in TypeScript and PostgreSQL.\n• Experience with Kubernetes.",
      });

    expect(matchRes.status).toBe(200);
    expect(matchRes.body.profile).toBeDefined();
    expect(matchRes.body.coverageMatrix).toBeDefined();
    expect(matchRes.body.coverageMatrix.overallMatchScore).toBeGreaterThan(50);
    expect(matchRes.body.atsAudit).toBeDefined();
  });
});
