export * from "./interface";
export * from "./local_fs";
export * from "./s3_adapter";

import { IBlobStore } from "./interface";
import { LocalFsBlobStore } from "./local_fs";
import { S3BlobStoreAdapter } from "./s3_adapter";

export function createBlobStore(): IBlobStore {
  if (process.env.S3_BUCKET) {
    return new S3BlobStoreAdapter({
      bucket: process.env.S3_BUCKET,
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.AWS_REGION || "us-east-1",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
  }

  return new LocalFsBlobStore(process.env.BLOB_STORE_PATH || "data/blobstore");
}
