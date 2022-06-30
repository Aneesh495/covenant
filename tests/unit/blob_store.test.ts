import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalFsBlobStore } from "@covenant/persistence";
import fs from "fs";
import path from "path";
import crypto from "crypto";

describe("Content Addressed Blob Store", () => {
  const testDir = path.resolve(process.cwd(), "tmp/test-blobstore-" + crypto.randomUUID());
  let store: LocalFsBlobStore;

  beforeEach(() => {
    store = new LocalFsBlobStore(testDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("stores a buffer, verifies SHA-256 and retrieves identical bytes", async () => {
    const payload = Buffer.from("Master Services Agreement between Alpha and Beta");
    const expectedSha256 = crypto.createHash("sha256").update(payload).digest("hex");

    const ref = await store.put(payload, "application/pdf");
    expect(ref.sha256).toBe(expectedSha256);
    expect(ref.byteSize).toBe(payload.length);
    expect(ref.mediaType).toBe("application/pdf");

    const retrieved = await store.get(ref.sha256);
    expect(retrieved.equals(payload)).toBe(true);

    const exists = await store.exists(ref.sha256);
    expect(exists).toBe(true);
  });

  it("deduplicates identical bytes without rewriting", async () => {
    const payload = Buffer.from("Duplicate content payload for testing deduplication");
    const ref1 = await store.put(payload, "text/plain");
    const ref2 = await store.put(payload, "text/plain");

    expect(ref1.sha256).toBe(ref2.sha256);
    expect(ref1.storageUri).toBe(ref2.storageUri);
  });

  it("throws 404 BLOB_NOT_FOUND when accessing non-existent blob", async () => {
    const nonExistent = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    await expect(store.get(nonExistent)).rejects.toThrow("Blob not found");
  });

  it("deletes blob and metadata cleanly", async () => {
    const payload = Buffer.from("Temporary blob to be deleted");
    const ref = await store.put(payload, "text/plain");

    expect(await store.exists(ref.sha256)).toBe(true);
    await store.delete(ref.sha256);
    expect(await store.exists(ref.sha256)).toBe(false);
  });
});
