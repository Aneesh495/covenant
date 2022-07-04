import { Pool } from "pg";
import { getPgPool } from "../connection";
import crypto from "crypto";

export interface AuditEventRecord {
  id: string;
  workspaceId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export class AuditRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPgPool()) {
    this.pool = pool;
  }

  async recordEvent(
    workspaceId: string,
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const id = `audit-${crypto.randomUUID()}`;
    const query = `
      INSERT INTO audit_events (
        id, workspace_id, actor_id, action, target_type, target_id, metadata_json, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id;
    `;
    const { rows } = await this.pool.query(query, [
      id,
      workspaceId,
      actorId,
      action,
      targetType,
      targetId,
      metadata ? JSON.stringify(metadata) : null,
    ]);
    return rows[0].id;
  }

  async listEvents(
    workspaceId: string,
    options: { limit?: number; offset?: number; targetType?: string } = {}
  ): Promise<AuditEventRecord[]> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    let query = `
      SELECT id, workspace_id, actor_id, action, target_type, target_id, metadata_json, created_at
      FROM audit_events
      WHERE workspace_id = $1
    `;
    const params: any[] = [workspaceId];

    if (options.targetType) {
      params.push(options.targetType);
      query += ` AND target_type = $${params.length}`;
    }

    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length};`;

    const { rows } = await this.pool.query(query, params);
    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      actorId: r.actor_id,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      metadata: r.metadata_json,
      createdAt: r.created_at,
    }));
  }
}
