import { Pool } from "pg";
import { getPgPool } from "../connection";
import { GroundedFinding, GroundedCitation, ReviewDecisionState, CovenantError } from "@covenant/shared";

export class FindingRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPgPool()) {
    this.pool = pool;
  }

  async getLatestRunForVersion(workspaceId: string, versionId: string): Promise<any | null> {
    const query = `
      SELECT id, task_id, workspace_id, document_version_id, comparison_version_id,
             workflow, status, summary_json, model_metadata_json, fencing_token,
             published_at, created_at
      FROM analysis_runs
      WHERE workspace_id = $1 AND document_version_id = $2
      ORDER BY published_at DESC
      LIMIT 1;
    `;
    const { rows } = await this.pool.query(query, [workspaceId, versionId]);
    if (rows.length === 0) return null;
    return rows[0];
  }

  async listFindingsForRun(workspaceId: string, runId: string): Promise<GroundedFinding[]> {
    const findingsQuery = `
      SELECT id, run_id, workspace_id, document_version_id, workflow,
             rule_id, category, severity, title, explanation,
             suggested_action, suggested_patch_json, confidence,
             decision_state, decision_note, decided_at, decided_by
      FROM findings
      WHERE workspace_id = $1 AND run_id = $2
      ORDER BY 
        CASE severity 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        created_at ASC;
    `;

    const { rows: findingRows } = await this.pool.query(findingsQuery, [workspaceId, runId]);
    if (findingRows.length === 0) return [];

    const findingIds = findingRows.map((f) => f.id);
    const citationsQuery = `
      SELECT id, finding_id, block_id, page_number, canonical_start, canonical_end,
             exact_quote, confidence, source_type, bounding_box_json
      FROM citations
      WHERE workspace_id = $1 AND finding_id = ANY($2::text[])
      ORDER BY canonical_start ASC;
    `;

    const { rows: citationRows } = await this.pool.query(citationsQuery, [workspaceId, findingIds]);

    const citationsByFinding = new Map<string, GroundedCitation[]>();
    for (const c of citationRows) {
      const list = citationsByFinding.get(c.finding_id) || [];
      list.push({
        id: c.id,
        blockId: c.block_id,
        pageNumber: c.page_number,
        startOffset: c.canonical_start,
        endOffset: c.canonical_end,
        exactQuote: c.exact_quote,
        confidence: parseFloat(c.confidence),
        sourceType: c.source_type,
        boundingBox: c.bounding_box_json,
      });
      citationsByFinding.set(c.finding_id, list);
    }

    return findingRows.map((f) => ({
      id: f.id,
      workflow: f.workflow,
      ruleId: f.rule_id || undefined,
      category: f.category,
      severity: f.severity,
      title: f.title,
      explanation: f.explanation,
      suggestedAction: f.suggested_action || undefined,
      suggestedPatch: f.suggested_patch_json || undefined,
      confidence: f.confidence,
      decisionState: f.decision_state,
      decisionNote: f.decision_note || undefined,
      decidedAt: f.decided_at ? f.decided_at.toISOString() : undefined,
      decidedBy: f.decided_by || undefined,
      citations: citationsByFinding.get(f.id) || [],
    }));
  }

  async updateFindingDecision(
    workspaceId: string,
    findingId: string,
    decisionState: ReviewDecisionState,
    note?: string,
    userId?: string
  ): Promise<void> {
    const query = `
      UPDATE findings
      SET decision_state = $1,
          decision_note = $2,
          decided_at = NOW(),
          decided_by = $3
      WHERE id = $4 AND workspace_id = $5;
    `;

    const res = await this.pool.query(query, [decisionState, note || null, userId || null, findingId, workspaceId]);
    if ((res.rowCount ?? 0) === 0) {
      throw new CovenantError({
        message: `Finding ${findingId} not found in workspace`,
        code: "NOT_FOUND",
        statusCode: 404,
      });
    }
  }
}
