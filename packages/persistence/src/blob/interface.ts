export interface BlobRef {
  sha256: string;
  byteSize: number;
  mediaType: string;
  storedAt: string;
  storageUri: string;
}

export interface IBlobStore {
  put(buffer: Buffer, mediaType: string): Promise<BlobRef>;
  get(sha256: string): Promise<Buffer>;
  exists(sha256: string): Promise<boolean>;
  delete(sha256: string): Promise<void>;
  getMetadata(sha256: string): Promise<BlobRef | null>;
}
