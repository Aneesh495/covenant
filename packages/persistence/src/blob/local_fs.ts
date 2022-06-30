import fs from "fs";
import path from "path";
import crypto from "crypto";
import { IBlobStore, BlobRef } from "./interface";
import { CovenantError } from "@covenant/shared";

export class LocalFsBlobStore implements IBlobStore {
  private readonly baseDir: string;

  constructor(baseDir: string = "data/blobstore") {
    this.baseDir = path.resolve(process.cwd(), baseDir);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getBlobPath(sha256: string): { dirPath: string; filePath: string; metaPath: string } {
    const prefix = sha256.slice(0, 2);
    const dirPath = path.join(this.baseDir, prefix);
    const filePath = path.join(dirPath, sha256);
    const metaPath = path.join(dirPath, `${sha256}.meta.json`);
    return { dirPath, filePath, metaPath };
  }

  async put(buffer: Buffer, mediaType: string): Promise<BlobRef> {
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const { dirPath, filePath, metaPath } = this.getBlobPath(sha256);

    const ref: BlobRef = {
      sha256,
      byteSize: buffer.length,
      mediaType,
      storedAt: new Date().toISOString(),
      storageUri: `file://${filePath}`,
    };

    // Deduplication check: if file already exists with same size, reuse without rewrite
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (stat.size === buffer.length) {
        if (!fs.existsSync(metaPath)) {
          fs.writeFileSync(metaPath, JSON.stringify(ref, null, 2), "utf-8");
        }
        return ref;
      }
    }

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Atomic write via temp file
    const tempPath = path.join(dirPath, `.tmp-${crypto.randomUUID()}`);
    fs.writeFileSync(tempPath, buffer);
    fs.renameSync(tempPath, filePath);

    fs.writeFileSync(metaPath, JSON.stringify(ref, null, 2), "utf-8");
    return ref;
  }

  async get(sha256: string): Promise<Buffer> {
    const { filePath } = this.getBlobPath(sha256);
    if (!fs.existsSync(filePath)) {
      throw new CovenantError({
        message: `Blob not found for hash: ${sha256}`,
        code: "BLOB_NOT_FOUND",
        statusCode: 404,
      });
    }

    return fs.readFileSync(filePath);
  }

  async exists(sha256: string): Promise<boolean> {
    const { filePath } = this.getBlobPath(sha256);
    return fs.existsSync(filePath);
  }

  async delete(sha256: string): Promise<void> {
    const { filePath, metaPath } = this.getBlobPath(sha256);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }
  }

  async getMetadata(sha256: string): Promise<BlobRef | null> {
    const { metaPath, filePath } = this.getBlobPath(sha256);
    if (!fs.existsSync(filePath)) return null;

    if (fs.existsSync(metaPath)) {
      try {
        const raw = fs.readFileSync(metaPath, "utf-8");
        return JSON.parse(raw);
      } catch {
        // Fallback to stat
      }
    }

    const stat = fs.statSync(filePath);
    return {
      sha256,
      byteSize: stat.size,
      mediaType: "application/octet-stream",
      storedAt: stat.birthtime.toISOString(),
      storageUri: `file://${filePath}`,
    };
  }
}
