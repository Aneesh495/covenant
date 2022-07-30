import { getPgPool } from "../packages/persistence/src/connection";
import { DocumentRepository } from "../packages/persistence/src/repositories/document_repo";
import { DocumentIngestionEngine } from "../packages/ingestion/src/index";
import { ContractReviewPipeline } from "../packages/contract-pipeline/src/pipeline";
import { ResumeIntelligencePipeline } from "../packages/resume-pipeline/src/pipeline";
import { BlobRef } from "../packages/persistence/src/blob";
import crypto from "crypto";

async function persistFindingsAndRun(
  pool: any,
  workspaceId: string,
  versionId: string,
  workflow: string,
  summary: any,
  findings: any[]
): Promise<void> {
  const taskId = `task-${crypto.randomUUID()}`;
  const runId = `run-${crypto.randomUUID()}`;

  await pool.query(
    `INSERT INTO analysis_tasks (id, workspace_id, document_version_id, workflow, status, payload_json, fencing_token, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'completed', '{}'::jsonb, 1, NOW(), NOW())`,
    [taskId, workspaceId, versionId, workflow]
  );

  await pool.query(
    `INSERT INTO analysis_runs (id, task_id, workspace_id, document_version_id, workflow, status, summary_json, model_metadata_json, fencing_token, published_at, created_at)
     VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, 1, NOW(), NOW())`,
    [
      runId,
      taskId,
      workspaceId,
      versionId,
      workflow,
      JSON.stringify(summary),
      JSON.stringify({ model: "deterministic-ast", verified: true }),
    ]
  );

  for (const f of findings) {
    await pool.query(
      `INSERT INTO findings (
        id, run_id, workspace_id, document_version_id, workflow,
        rule_id, category, severity, title, explanation,
        suggested_action, suggested_patch_json, confidence,
        decision_state, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', NOW())`,
      [
        f.id,
        runId,
        workspaceId,
        versionId,
        workflow,
        f.ruleId || null,
        f.category,
        f.severity,
        f.title,
        f.explanation,
        f.suggestedAction || null,
        f.suggestedPatch ? JSON.stringify(f.suggestedPatch) : null,
        f.confidence || 1.0,
      ]
    );

    for (const c of f.citations || []) {
      await pool.query(
        `INSERT INTO citations (
          id, finding_id, workspace_id, document_version_id,
          block_id, page_number, canonical_start, canonical_end,
          exact_quote, confidence, source_type, bounding_box_json, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
        [
          c.id,
          f.id,
          workspaceId,
          versionId,
          c.blockId,
          c.pageNumber,
          c.startOffset,
          c.endOffset,
          c.exactQuote,
          c.confidence,
          c.sourceType,
          c.boundingBox ? JSON.stringify(c.boundingBox) : null,
        ]
      );
    }
  }
}

export async function seedDemoData(): Promise<void> {
  const pool = getPgPool();
  const docRepo = new DocumentRepository(pool);
  const ingestion = new DocumentIngestionEngine();
  const contractPipeline = new ContractReviewPipeline();
  const resumePipeline = new ResumeIntelligencePipeline();

  console.log("[Seed] Starting demo database seed...");

  // 1. Ensure default demo workspace
  const workspaceId = "ws-demo-workbench";
  await pool.query(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ($1, 'Production Workbench', 'demo-workbench', NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [workspaceId]
  );

  // 2. Demo Contract 1: Non-Disclosure Agreement (v1 with non-compliant clauses)
  const ndaTextV1 = `MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement (the "Agreement") is entered into as of October 1, 2026, by and between Apex Systems Inc. ("Disclosing Party") and Beacon Technologies LLC ("Receiving Party").

1. Purpose and Scope
The parties wish to explore a potential strategic integration (the "Permitted Purpose"). In connection therewith, each party may disclose proprietary and confidential materials to the other.

2. Confidentiality Obligations and Duration
The Receiving Party shall protect Disclosing Party Confidential Information with the same degree of care it uses for its own sensitive information, but no less than reasonable care. Receiving Party agrees that all obligations of confidentiality and restrictions on use shall survive for a period of five (5) years from the date of initial disclosure.

3. Standard Exclusions
Confidential Information does not include information that: (a) is or becomes publicly known through no breach by Receiving Party; (b) was already known prior to disclosure; (c) is independently developed without reference to Confidential Information; or (d) is rightfully received from a third party without obligation of confidentiality.

4. Remedies and Equitable Relief
Receiving Party acknowledges that any breach of this Agreement will cause irreparable injury for which monetary damages alone would be inadequate. Disclosing Party shall be entitled to seek injunctive relief without posting a bond or proving actual monetary damages.

5. Governing Law and Dispute Resolution
This Agreement and any dispute arising hereunder shall be governed by, and construed in accordance with, the laws of the State of Delaware, without regard to its conflict of law principles.`;

  const ndaBufV1 = Buffer.from(ndaTextV1, "utf-8");
  const ndaSha256V1 = crypto.createHash("sha256").update(ndaBufV1).digest("hex");
  const ndaBlobRefV1: BlobRef = {
    sha256: ndaSha256V1,
    byteSize: ndaBufV1.length,
    mediaType: "text/plain",
    storageUri: `file://${process.cwd()}/uploads/${ndaSha256V1}`,
    storedAt: new Date().toISOString(),
  };

  const ndaDocIRV1 = await ingestion.ingest({
    buffer: ndaBufV1,
    filename: "Apex_Beacon_Mutual_NDA_v1.txt",
    mediaType: "text/plain",
  });

  const { document: ndaDocV1, version: ndaVerV1 } = await docRepo.createDocumentWithVersion({
    workspaceId,
    documentType: "contract",
    title: "Apex & Beacon Mutual NDA (v1)",
    originalFilename: "Apex_Beacon_Mutual_NDA_v1.txt",
    documentIr: ndaDocIRV1,
    blobRef: ndaBlobRefV1,
  });

  const ndaAnalysisV1 = contractPipeline.analyzeContract(ndaDocIRV1, { playbookType: "nda" });
  await persistFindingsAndRun(
    pool,
    workspaceId,
    ndaVerV1.id,
    "contract_review",
    ndaAnalysisV1.summary,
    ndaAnalysisV1.findings
  );
  console.log(`[Seed] Seeded Contract: ${ndaDocV1.title} (${ndaAnalysisV1.findings.length} findings)`);

  // 3. Demo Contract 2: Non-Disclosure Agreement (v2 with compliant clauses for revision comparison)
  const ndaTextV2 = `MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement (the "Agreement") is entered into as of October 1, 2026, by and between Apex Systems Inc. ("Disclosing Party") and Beacon Technologies LLC ("Receiving Party").

1. Purpose and Scope
The parties wish to explore a potential strategic integration (the "Permitted Purpose"). In connection therewith, each party may disclose proprietary and confidential materials to the other.

2. Confidentiality Obligations and Duration
The Receiving Party shall protect Disclosing Party Confidential Information with the same degree of care it uses for its own sensitive information, but no less than reasonable care. Receiving Party agrees that all obligations of confidentiality and restrictions on use shall survive for a period of two (2) years from the date of initial disclosure.

3. Standard Exclusions
Confidential Information does not include information that: (a) is or becomes publicly known through no breach by Receiving Party; (b) was already known prior to disclosure; (c) is independently developed without reference to Confidential Information; or (d) is rightfully received from a third party without obligation of confidentiality.

4. Remedies and Equitable Relief
Receiving Party acknowledges that any breach of this Agreement may cause injury. Either party may seek injunctive relief from a court of competent jurisdiction to prevent unauthorized disclosure.

5. Governing Law and Dispute Resolution
This Agreement and any dispute arising hereunder shall be governed by, and construed in accordance with, the laws of the State of Delaware, without regard to its conflict of law principles.`;

  const ndaBufV2 = Buffer.from(ndaTextV2, "utf-8");
  const ndaSha256V2 = crypto.createHash("sha256").update(ndaBufV2).digest("hex");
  const ndaBlobRefV2: BlobRef = {
    sha256: ndaSha256V2,
    byteSize: ndaBufV2.length,
    mediaType: "text/plain",
    storageUri: `file://${process.cwd()}/uploads/${ndaSha256V2}`,
    storedAt: new Date().toISOString(),
  };

  const ndaDocIRV2 = await ingestion.ingest({
    buffer: ndaBufV2,
    filename: "Apex_Beacon_Mutual_NDA_v2.txt",
    mediaType: "text/plain",
  });

  const { document: ndaDocV2, version: ndaVerV2 } = await docRepo.createDocumentWithVersion({
    workspaceId,
    documentType: "contract",
    title: "Apex & Beacon Mutual NDA (v2 - Remediated)",
    originalFilename: "Apex_Beacon_Mutual_NDA_v2.txt",
    documentIr: ndaDocIRV2,
    blobRef: ndaBlobRefV2,
  });

  const ndaAnalysisV2 = contractPipeline.analyzeContract(ndaDocIRV2, { playbookType: "nda" });
  await persistFindingsAndRun(
    pool,
    workspaceId,
    ndaVerV2.id,
    "contract_review",
    ndaAnalysisV2.summary,
    ndaAnalysisV2.findings
  );
  console.log(`[Seed] Seeded Contract: ${ndaDocV2.title} (${ndaAnalysisV2.findings.length} findings)`);

  // 4. Demo Resume 1: Principal Distributed Systems Engineer
  const resumeText = `Alex Chen
San Francisco, CA | alex.chen@distributedlabs.io | github.com/alexchen | linkedin.com/in/alexchen-dist

SUMMARY
Principal Distributed Systems Engineer with 10 years of experience designing fault-tolerant storage engines, raft-based consensus algorithms, and multi-region microservices handling 250,000 requests per second.

EXPERIENCE

Apex Infrastructure | Principal Engineer
January 2021 to Present | San Francisco, CA
- Architected a distributed key-value metadata store using Raft consensus, reducing tail latency by 42% across 3 geo-distributed regions.
- Led migration of 180 services from Apache Mesos to Kubernetes, cutting monthly AWS compute expenditure by $180,000.
- Implemented zero-allocation byte deserializer in Go, increasing single-node throughput from 45,000 to 110,000 ops/sec.

Helios Cloud | Senior Systems Engineer
June 2017 to December 2020 | Seattle, WA
- Built real-time log ingestion pipeline processing 250,000 events/sec utilizing Apache Kafka and ClickHouse.
- Designed automated disaster recovery failover reducing RTO from 15 minutes to 35 seconds.
- Mentored 8 junior and mid-level engineers in concurrency patterns, distributed debugging, and profiling.

Crestline Systems | Systems Software Engineer
August 2014 to May 2017 | Austin, TX
- Developed C++ network driver layer for high-frequency order book replication with sub-millisecond roundtrips.
- Automated multi-datacenter deployment pipelines using Terraform and Docker.

SKILLS
- Languages: Go, Rust, C++, Python, TypeScript, SQL
- Distributed Systems: Raft, Paxos, Kafka, gRPC, Protobuf, etcd
- Storage and Databases: PostgreSQL, ClickHouse, Redis, RocksDB
- Cloud and Infra: Kubernetes, Docker, AWS, GCP, Terraform, Linux

EDUCATION
University of Washington
Bachelor of Science in Computer Science, 2014`;

  const targetJobDescription = `Senior Distributed Systems Architect
Requirements:
- 8+ years of engineering experience with distributed systems in production.
- Extensive proficiency in Go, Rust, or C++.
- Hands-on expertise building consensus-driven systems (Raft, Paxos, or etcd).
- Strong track record optimizing distributed storage, latencies, and high-throughput pipelines.
- Bachelor's degree in Computer Science or equivalent practical experience.`;

  const resBuf = Buffer.from(resumeText, "utf-8");
  const resSha256 = crypto.createHash("sha256").update(resBuf).digest("hex");
  const resBlobRef: BlobRef = {
    sha256: resSha256,
    byteSize: resBuf.length,
    mediaType: "text/plain",
    storageUri: `file://${process.cwd()}/uploads/${resSha256}`,
    storedAt: new Date().toISOString(),
  };

  const resDocIR = await ingestion.ingest({
    buffer: resBuf,
    filename: "Alex_Chen_Principal_Systems_Engineer.txt",
    mediaType: "text/plain",
  });

  const { document: resDoc, version: resVer } = await docRepo.createDocumentWithVersion({
    workspaceId,
    documentType: "resume",
    title: "Alex Chen - Principal Systems Engineer",
    originalFilename: "Alex_Chen_Principal_Systems_Engineer.txt",
    documentIr: resDocIR,
    blobRef: resBlobRef,
  });

  const resumeAnalysis = resumePipeline.analyzeResume(resDocIR, { jobDescription: targetJobDescription });
  const richSummary = {
    ...resumeAnalysis.summary,
    profile: resumeAnalysis.profile,
    coverageMatrix: resumeAnalysis.coverageMatrix,
    atsAudit: resumeAnalysis.atsAudit,
    bulletRevisions: resumeAnalysis.bulletRevisions,
  };

  await persistFindingsAndRun(
    pool,
    workspaceId,
    resVer.id,
    "resume_intelligence",
    richSummary,
    resumeAnalysis.findings
  );
  console.log(`[Seed] Seeded Resume: ${resDoc.title} (Match score: ${richSummary.coverageMatrix?.overallMatchScore}%)`);

  console.log("[Seed] Demo seeding completed successfully!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Seed] Error during seeding:", err);
      process.exit(1);
    });
}
