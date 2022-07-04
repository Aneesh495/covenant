import { Pool } from "pg";
import { getPgPool } from "../connection";
import { WorkspaceRole, WorkspaceAuthorizationError } from "@covenant/shared";
import crypto from "crypto";

export interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMemberRecord {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: Date;
}

export class WorkspaceRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPgPool()) {
    this.pool = pool;
  }

  async createWorkspace(name: string, slug: string, ownerUserId: string): Promise<WorkspaceRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const wsId = `ws-${crypto.randomUUID()}`;

      const insertWsQuery = `
        INSERT INTO workspaces (id, name, slug, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING id, name, slug, created_at, updated_at;
      `;
      const { rows: wsRows } = await client.query(insertWsQuery, [wsId, name, slug]);

      const memberId = `mem-${crypto.randomUUID()}`;
      const insertMemberQuery = `
        INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
        VALUES ($1, $2, $3, 'owner', NOW());
      `;
      await client.query(insertMemberQuery, [memberId, wsId, ownerUserId]);

      await client.query("COMMIT");
      const r = wsRows[0];
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getWorkspaceById(id: string): Promise<WorkspaceRecord | null> {
    const { rows } = await this.pool.query(
      "SELECT id, name, slug, created_at, updated_at FROM workspaces WHERE id = $1",
      [id]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async getWorkspaceBySlug(slug: string): Promise<WorkspaceRecord | null> {
    const { rows } = await this.pool.query(
      "SELECT id, name, slug, created_at, updated_at FROM workspaces WHERE slug = $1",
      [slug]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async getMemberRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
    const { rows } = await this.pool.query(
      "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
      [workspaceId, userId]
    );
    return rows.length > 0 ? (rows[0].role as WorkspaceRole) : null;
  }

  async verifyMemberAccess(workspaceId: string, userId: string, minimumRole: WorkspaceRole = "viewer"): Promise<WorkspaceRole> {
    const role = await this.getMemberRole(workspaceId, userId);
    if (!role) {
      throw new WorkspaceAuthorizationError(`User is not a member of workspace ${workspaceId}`);
    }

    const roleHierarchy: Record<WorkspaceRole, number> = {
      viewer: 1,
      reviewer: 2,
      admin: 3,
      owner: 4,
    };

    if (roleHierarchy[role] < roleHierarchy[minimumRole]) {
      throw new WorkspaceAuthorizationError(`Action requires ${minimumRole} role, but user has ${role}`);
    }

    return role;
  }

  async listUserWorkspaces(userId: string): Promise<WorkspaceRecord[]> {
    const query = `
      SELECT w.id, w.name, w.slug, w.created_at, w.updated_at
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = $1
      ORDER BY w.name ASC;
    `;
    const { rows } = await this.pool.query(query, [userId]);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }
}
