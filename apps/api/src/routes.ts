import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import crypto from "crypto";
import pg from "pg";
import {
  PostgresTaskQueue,
  DocumentRepository,
  FindingRepository,
  AuditRepository,
  WorkspaceRepository,
  LocalFsBlobStore,
  IBlobStore,
} from "@covenant/persistence";
import { DocumentIngestionEngine, SignatureValidator } from "@covenant/ingestion";
import { ContractReviewPipeline, VersionComparator } from "@covenant/contract-pipeline";
import { ResumeIntelligencePipeline, RoleRequirementParser, RequirementCoverageMatcher } from "@covenant/resume-pipeline";
import { DocumentIR } from "@covenant/document-ir";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
});

export interface ApiDependencies {
  pool: pg.Pool;
  blobStore?: IBlobStore;
}

export function registerApiRoutes(app: Express, deps: ApiDependencies): Server {
  const pool = deps.pool;
  const blobStore = deps.blobStore || new LocalFsBlobStore("./data/blobs");
  const taskQueue = new PostgresTaskQueue(pool);
  const docRepo = new DocumentRepository(pool);
  const findingRepo = new FindingRepository(pool);
  const auditRepo = new AuditRepository(pool);
  const workspaceRepo = new WorkspaceRepository(pool);

  const ingestionEngine = new DocumentIngestionEngine();
  const contractPipeline = new ContractReviewPipeline();
  const resumePipeline = new ResumeIntelligencePipeline();
  const comparator = new VersionComparator();
  const requirementParser = new RoleRequirementParser();
  const coverageMatcher = new RequirementCoverageMatcher();

  async function getOrCreateWorkspace(sessionId: string): Promise<string> {
    const slug = `ws-${sessionId.slice(0, 16)}`;
    const existing = await pool.query(
      `SELECT id FROM workspaces WHERE slug = $1 LIMIT 1`,
      [slug]
    );
    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }

    const id = `ws-${crypto.randomUUID()}`;
    const created = await pool.query(
      `INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3) RETURNING id`,
      [id, `Workspace ${sessionId.slice(0, 8)}`, slug]
    );
    return created.rows[0].id;
  }

  function getSessionId(req: any): string {
    if (!req.session) {
      return "anon-session-default";
    }
    if (!req.session.sessionId) {
      req.session.sessionId = crypto.randomUUID();
    }
    return req.session.sessionId;
  }

  // 1. Document Upload and Ingestion
  app.post("/api/documents/upload", upload.single("document"), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file provided in 'document' field." });
      }

      const documentType = (req.body.documentType as string) || "contract";
      if (!["contract", "resume"].includes(documentType)) {
        return res.status(400).json({ error: "Invalid documentType. Must be 'contract' or 'resume'." });
      }

      const sessionId = getSessionId(req);
      const workspaceId = await getOrCreateWorkspace(sessionId);

      // Validate signature
      const sigValidation = SignatureValidator.validateBuffer(file.buffer);
      if (!sigValidation.isValid) {
        return res.status(400).json({
          error: `File signature validation failed: ${sigValidation.error}`,
          code: "INVALID_SIGNATURE",
        });
      }

      // Store in content-addressed blob store
      const blobRef = await blobStore.put(file.buffer, file.mimetype);
      const blobHash = blobRef.sha256;

      // Ingest into DocumentIR
      const docIR = await ingestionEngine.ingest({
        buffer: file.buffer,
        filename: file.originalname,
        mediaType: file.mimetype,
      });

      // Persist document and initial version
      const { document, version } = await docRepo.createDocumentWithVersion({
        workspaceId,
        documentType: documentType as any,
        title: file.originalname.replace(/\.[^.]+$/, ""),
        originalFilename: file.originalname,
        documentIr: docIR,
        blobRef,
      });

      const documentId = document.id;
      const versionId = version.id;

      // Enqueue durable task
      const taskType = documentType === "contract" ? "contract_review" : "resume_intelligence";
      const task = await taskQueue.enqueueTask({
        workspaceId,
        documentVersionId: versionId,
        workflow: taskType,
        payload: {
          documentId,
          versionId,
          blobHash,
          filename: file.originalname,
          mediaType: file.mimetype,
          jobDescription: req.body.jobDescription,
          playbookType: req.body.playbookType || (documentType === "contract" ? "nda" : undefined),
        },
      });

      // Compute synchronous baseline analysis for immediate responsiveness
      let initialFindingsCount = 0;
      if (documentType === "contract") {
        const analysis = contractPipeline.analyzeContract(docIR, { playbookType: req.body.playbookType || "nda" });
        initialFindingsCount = analysis.findings.length;
      } else {
        const analysis = resumePipeline.analyzeResume(docIR, { jobDescription: req.body.jobDescription });
        initialFindingsCount = analysis.findings.length;
      }

      return res.status(201).json({
        message: `${documentType === "contract" ? "Contract" : "Resume"} uploaded and queued for intelligence analysis.`,
        documentId,
        versionId,
        taskId: task.id,
        status: "pending",
        initialFindingsCount,
      });
    } catch (err: any) {
      console.error("[API] Upload error:", err);
      return res.status(500).json({ error: err.message || "Failed to process document upload." });
    }
  });

  // 2. Query Durable Task Status
  app.get("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const taskRes = await pool.query(`SELECT * FROM analysis_tasks WHERE id = $1`, [req.params.id]);
      if (taskRes.rows.length === 0) {
        return res.status(404).json({ error: "Task not found." });
      }
      const row = taskRes.rows[0];
      return res.json({
        id: row.id,
        workflow: row.workflow,
        status: row.status,
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
        errorMessage: row.error_message,
        payload: row.payload_json,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 3. List Documents in Workspace
  app.get("/api/documents", async (req: Request, res: Response) => {
    try {
      const sessionId = getSessionId(req);
      const workspaceId = await getOrCreateWorkspace(sessionId);

      const docsRes = await pool.query(
        `SELECT d.*, 
          COALESCE(dv.page_count, 1) as page_count,
          COALESCE(dv.sha256, '') as sha256,
          COALESCE((SELECT COUNT(*) FROM findings f WHERE f.document_version_id = d.current_version_id), 0) as findings_count
         FROM documents d
         LEFT JOIN document_versions dv ON dv.id = d.current_version_id
         WHERE d.workspace_id = $1 AND d.is_deleted = false
         ORDER BY d.created_at DESC`,
        [workspaceId]
      );

      return res.json(docsRes.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 4. Get Document Details and Latest Version
  app.get("/api/documents/:id", async (req: Request, res: Response) => {
    try {
      const docId = req.params.id;
      const sessionId = getSessionId(req);
      const workspaceId = await getOrCreateWorkspace(sessionId);

      const document = await docRepo.getDocument(workspaceId, docId);
      if (!document) {
        return res.status(404).json({ error: "Document not found." });
      }

      const version = document.currentVersionId
        ? await docRepo.getDocumentVersion(workspaceId, document.currentVersionId)
        : null;

      const findingsRes = await pool.query(
        `SELECT f.*, 
          COALESCE((SELECT json_agg(c.*) FROM citations c WHERE c.finding_id = f.id), '[]'::json) as citations
         FROM findings f
         WHERE f.document_version_id = $1
         ORDER BY f.created_at ASC`,
        [version?.id || ""]
      );

      return res.json({
        document,
        latestVersion: version,
        findings: findingsRes.rows,
        summary: {
          totalFindings: findingsRes.rows.length,
          criticalCount: findingsRes.rows.filter((r) => r.severity === "critical").length,
          highCount: findingsRes.rows.filter((r) => r.severity === "high").length,
          pendingCount: findingsRes.rows.filter((r) => r.decision_state === "pending").length,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 5. Get Document IR
  app.get("/api/documents/:id/ir", async (req: Request, res: Response) => {
    try {
      const docId = req.params.id;
      const sessionId = getSessionId(req);
      const workspaceId = await getOrCreateWorkspace(sessionId);

      const document = await docRepo.getDocument(workspaceId, docId);
      if (!document || !document.currentVersionId) {
        return res.status(404).json({ error: "Document not found." });
      }

      const version = await docRepo.getDocumentVersion(workspaceId, document.currentVersionId);
      if (!version) {
        return res.status(404).json({ error: "Document version not found." });
      }

      return res.json(version.documentIr);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 6. Review Triage Decision (Accept, Reject, Defer)
  app.patch("/api/findings/:id/decision", async (req: Request, res: Response) => {
    try {
      const findingId = req.params.id;
      const { decisionState, reviewerNotes } = req.body;

      if (!["pending", "accepted", "rejected", "deferred"].includes(decisionState)) {
        return res.status(400).json({ error: "Invalid decisionState. Must be pending, accepted, rejected, or deferred." });
      }

      const updateRes = await pool.query(
        `UPDATE findings 
         SET decision_state = $1, decision_note = COALESCE($2, decision_note), decided_at = NOW(), decided_by = 'reviewer-1'
         WHERE id = $3
         RETURNING *`,
        [decisionState, reviewerNotes || null, findingId]
      );

      if (updateRes.rows.length === 0) {
        return res.status(404).json({ error: "Finding not found." });
      }

      const updated = updateRes.rows[0];

      // Append to audit log
      await auditRepo.recordEvent(
        updated.workspace_id,
        "reviewer-1",
        "finding_decision",
        "finding",
        findingId,
        { decisionState, reviewerNotes }
      );

      return res.json({
        id: updated.id,
        decision_state: updated.decision_state,
        reviewer_notes: updated.decision_note,
        decided_at: updated.decided_at,
        ...updated,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 7. Version Comparison Between Revisions
  app.post("/api/documents/compare", async (req: Request, res: Response) => {
    try {
      const { baseDocumentId, targetDocumentId } = req.body;
      if (!baseDocumentId || !targetDocumentId) {
        return res.status(400).json({ error: "baseDocumentId and targetDocumentId are required." });
      }

      const sessionId = getSessionId(req);
      const workspaceId = await getOrCreateWorkspace(sessionId);

      const [baseDoc, targetDoc] = await Promise.all([
        docRepo.getDocument(workspaceId, baseDocumentId),
        docRepo.getDocument(workspaceId, targetDocumentId),
      ]);

      if (!baseDoc || !baseDoc.currentVersionId) {
        return res.status(404).json({ error: "Base document not found." });
      }
      if (!targetDoc || !targetDoc.currentVersionId) {
        return res.status(404).json({ error: "Target document not found." });
      }

      const [baseVer, targetVer] = await Promise.all([
        docRepo.getDocumentVersion(workspaceId, baseDoc.currentVersionId),
        docRepo.getDocumentVersion(workspaceId, targetDoc.currentVersionId),
      ]);

      if (!baseVer) return res.status(404).json({ error: "Base document IR not found." });
      if (!targetVer) return res.status(404).json({ error: "Target document IR not found." });

      const comparison = comparator.compareContracts(baseVer.documentIr, targetVer.documentIr);
      return res.json(comparison);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 8. Match Resume Against Role Requirements
  app.post("/api/resumes/:id/match", async (req: Request, res: Response) => {
    try {
      const docId = req.params.id;
      const { jobDescription } = req.body;

      if (!jobDescription || jobDescription.trim().length < 10) {
        return res.status(400).json({ error: "jobDescription is required." });
      }

      const sessionId = getSessionId(req);
      const workspaceId = await getOrCreateWorkspace(sessionId);

      const doc = await docRepo.getDocument(workspaceId, docId);
      if (!doc || !doc.currentVersionId) {
        return res.status(404).json({ error: "Resume document not found." });
      }

      const version = await docRepo.getDocumentVersion(workspaceId, doc.currentVersionId);
      if (!version) {
        return res.status(404).json({ error: "Resume document version not found." });
      }

      const docIR = version.documentIr;
      const analysis = resumePipeline.analyzeResume(docIR, { jobDescription });

      return res.json({
        profile: analysis.profile,
        coverageMatrix: analysis.coverageMatrix,
        atsAudit: analysis.atsAudit,
        bulletRevisions: analysis.bulletRevisions,
        summary: analysis.summary,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Compatibility routes for legacy frontend
  app.get("/api/contracts", async (req: Request, res: Response) => {
    try {
      const sessionId = getSessionId(req);
      const workspaceId = await getOrCreateWorkspace(sessionId);
      const docsRes = await pool.query(
        `SELECT * FROM documents WHERE workspace_id = $1 AND document_type = 'contract' ORDER BY created_at DESC`,
        [workspaceId]
      );
      return res.json(docsRes.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/contracts/:id", async (req: Request, res: Response) => {
    try {
      const docId = req.params.id;
      const sessionId = getSessionId(req);
      const workspaceId = await getOrCreateWorkspace(sessionId);

      const document = await docRepo.getDocument(workspaceId, docId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const findingsRes = await pool.query(
        `SELECT * FROM findings WHERE document_version_id = $1 ORDER BY created_at ASC`,
        [document.currentVersionId || ""]
      );

      return res.json({
        contract: document,
        clauses: findingsRes.rows,
        summary: {
          totalFindings: findingsRes.rows.length,
          criticalCount: findingsRes.rows.filter((r) => r.severity === "critical").length,
        },
        document,
        items: findingsRes.rows,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/profile", (req: Request, res: Response) => {
    res.json({ name: "Demo User", email: "demo@covenant.local", role: "reviewer" });
  });

  app.post("/api/profile", (req: Request, res: Response) => {
    res.json({ success: true, profile: req.body });
  });

  return createServer(app);
}
