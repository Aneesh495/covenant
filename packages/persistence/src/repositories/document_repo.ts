import { Pool } from "pg";
import { getPgPool } from "../connection";
import { DocumentIR } from "@covenant/document-ir";
import { BlobRef } from "../blob";
import { CovenantError } from "@covenant/shared";
import crypto from "crypto";

export interface CreateDocumentParams {
  workspaceId: string;
  documentType: "contract" | "resume" | "job_description" | "policy";
  title: string;
  originalFilename: string;
  documentIr: DocumentIR;
  blobRef: BlobRef;
}

export interface DocumentRecord {
  id: string;
  workspaceId: string;
  documentType: string;
  title: string;
  originalFilename: string;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentVersionRecord {
  id: string;
  documentId: string;
  workspaceId: string;
  versionNumber: number;
  sha256: string;
  byteSize: number;
  mediaType: string;
  storageUri: string;
  extractorVersion: string;
  pageCount: number;
  canonicalText: string;
  documentIr: DocumentIR;
  createdAt: Date;
}

export class DocumentRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPgPool()) {
    this.pool = pool;
  }

  async createDocumentWithVersion(params: CreateDocumentParams): Promise<{ document: DocumentRecord; version: DocumentVersionRecord }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const docId = `doc-${crypto.randomUUID()}`;
      const versionId = `ver-${crypto.randomUUID()}`;

      // Insert document row
      const insertDocQuery = `
        INSERT INTO documents (
          id, workspace_id, document_type, title, original_filename,
          current_version_id, is_deleted, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, false, NOW(), NOW())
        RETURNING id, workspace_id, document_type, title, original_filename, current_version_id, created_at, updated_at;
      `;

      const { rows: docRows } = await client.query(insertDocQuery, [
        docId,
        params.workspaceId,
        params.documentType,
        params.title,
        params.originalFilename,
        versionId,
      ]);

      // Insert document version row
      const insertVerQuery = `
        INSERT INTO document_versions (
          id, document_id, workspace_id, version_number, sha256,
          byte_size, media_type, storage_uri, extractor_version,
          page_count, canonical_text, document_ir_json, created_at
        ) VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING id, document_id, workspace_id, version_number, sha256,
                  byte_size, media_type, storage_uri, extractor_version,
                  page_count, canonical_text, document_ir_json, created_at;
      `;

      const { rows: verRows } = await client.query(insertVerQuery, [
        versionId,
        docId,
        params.workspaceId,
        params.blobRef.sha256,
        params.blobRef.byteSize,
        params.blobRef.mediaType,
        params.blobRef.storageUri,
        params.documentIr.extractorVersion,
        params.documentIr.pageCount,
        params.documentIr.canonicalText,
        JSON.stringify(params.documentIr),
      ]);

      // Insert source blocks for citation lookup
      for (const page of params.documentIr.pages) {
        for (const block of page.blocks) {
          const insertBlockQuery = `
            INSERT INTO source_blocks (
              id, document_version_id, workspace_id, block_id, page_number,
              block_type, canonical_start, canonical_end, text, confidence,
              is_ocr, bounding_box_json, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW());
          `;

          await client.query(insertBlockQuery, [
            `sb-${crypto.randomUUID()}`,
            versionId,
            params.workspaceId,
            block.id,
            page.pageNumber,
            block.type,
            block.canonicalStart,
            block.canonicalEnd,
            block.text,
            String(block.confidence),
            block.isOcr,
            block.boundingBox ? JSON.stringify(block.boundingBox) : null,
          ]);
        }
      }

      await client.query("COMMIT");

      const d = docRows[0];
      const v = verRows[0];

      return {
        document: {
          id: d.id,
          workspaceId: d.workspace_id,
          documentType: d.document_type,
          title: d.title,
          originalFilename: d.original_filename,
          currentVersionId: d.current_version_id,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        },
        version: {
          id: v.id,
          documentId: v.document_id,
          workspaceId: v.workspace_id,
          versionNumber: v.version_number,
          sha256: v.sha256,
          byteSize: v.byte_size,
          mediaType: v.media_type,
          storageUri: v.storage_uri,
          extractorVersion: v.extractor_version,
          pageCount: v.page_count,
          canonicalText: v.canonical_text,
          documentIr: v.document_ir_json,
          createdAt: v.created_at,
        },
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getDocument(workspaceId: string, documentId: string): Promise<DocumentRecord | null> {
    const query = `
      SELECT id, workspace_id, document_type, title, original_filename,
             current_version_id, created_at, updated_at
      FROM documents
      WHERE id = $1 AND workspace_id = $2 AND is_deleted = false;
    `;
    const { rows } = await this.pool.query(query, [documentId, workspaceId]);
    if (rows.length === 0) return null;
    const d = rows[0];
    return {
      id: d.id,
      workspaceId: d.workspace_id,
      documentType: d.document_type,
      title: d.title,
      originalFilename: d.original_filename,
      currentVersionId: d.current_version_id,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    };
  }

  async getDocumentVersion(workspaceId: string, versionId: string): Promise<DocumentVersionRecord | null> {
    const query = `
      SELECT id, document_id, workspace_id, version_number, sha256,
             byte_size, media_type, storage_uri, extractor_version,
             page_count, canonical_text, document_ir_json, created_at
      FROM document_versions
      WHERE id = $1 AND workspace_id = $2;
    `;
    const { rows } = await this.pool.query(query, [versionId, workspaceId]);
    if (rows.length === 0) return null;
    const v = rows[0];
    return {
      id: v.id,
      documentId: v.document_id,
      workspaceId: v.workspace_id,
      versionNumber: v.version_number,
      sha256: v.sha256,
      byteSize: v.byte_size,
      mediaType: v.media_type,
      storageUri: v.storage_uri,
      extractorVersion: v.extractor_version,
      pageCount: v.page_count,
      canonicalText: v.canonical_text,
      documentIr: v.document_ir_json,
      createdAt: v.created_at,
    };
  }

  async listDocuments(
    workspaceId: string,
    options: { documentType?: string; limit?: number; offset?: number } = {}
  ): Promise<DocumentRecord[]> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    let query = `
      SELECT id, workspace_id, document_type, title, original_filename,
             current_version_id, created_at, updated_at
      FROM documents
      WHERE workspace_id = $1 AND is_deleted = false
    `;
    const params: any[] = [workspaceId];

    if (options.documentType) {
      params.push(options.documentType);
      query += ` AND document_type = $${params.length}`;
    }

    params.push(limit, offset);
    query += ` ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length};`;

    const { rows } = await this.pool.query(query, params);
    return rows.map((d) => ({
      id: d.id,
      workspaceId: d.workspace_id,
      documentType: d.document_type,
      title: d.title,
      originalFilename: d.original_filename,
      currentVersionId: d.current_version_id,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  async deleteDocument(workspaceId: string, documentId: string): Promise<void> {
    const query = `
      UPDATE documents
      SET is_deleted = true, updated_at = NOW()
      WHERE id = $1 AND workspace_id = $2;
    `;
    const res = await this.pool.query(query, [documentId, workspaceId]);
    if ((res.rowCount ?? 0) === 0) {
      throw new CovenantError({
        message: `Document ${documentId} not found in workspace`,
        code: "DOCUMENT_NOT_FOUND",
        statusCode: 404,
      });
    }
  }
}
