import { IngestionError } from "@covenant/shared";

export interface FileValidationOptions {
  maxSizeBytes?: number;
  maxPageCount?: number;
  allowedMediaTypes?: string[];
}

export const DEFAULT_MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const DEFAULT_MAX_EXPANDED_BYTES = 100 * 1024 * 1024; // 100 MB
export const DEFAULT_MAX_PAGES = 300;

export const SUPPORTED_MEDIA_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
] as const;

export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

export function detectMediaType(buffer: Buffer): SupportedMediaType {
  if (buffer.length < 4) {
    throw new IngestionError("File is too small to determine format", "CORRUPT_DOCUMENT");
  }

  // PDF signature: %PDF-
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "application/pdf";
  }

  // ZIP signature (DOCX): PK\x03\x04
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  // UTF-8 plain text heuristic: check if bytes are valid UTF-8 and non-binary
  let isBinary = false;
  const sampleLen = Math.min(buffer.length, 1024);
  for (let i = 0; i < sampleLen; i++) {
    const byte = buffer[i];
    if (byte === 0 || (byte < 7 && byte !== 0) || (byte > 14 && byte < 32 && byte !== 27)) {
      isBinary = true;
      break;
    }
  }

  if (!isBinary) {
    return "text/plain";
  }

  throw new IngestionError("Unsupported media type or binary payload detected", "UNSUPPORTED_MEDIA_TYPE");
}

export function validateInputFile(
  buffer: Buffer,
  options: FileValidationOptions = {}
): SupportedMediaType {
  const maxBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;

  if (buffer.length === 0) {
    throw new IngestionError("Uploaded document is empty", "CORRUPT_DOCUMENT");
  }

  if (buffer.length > maxBytes) {
    throw new IngestionError(
      `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds limit of ${(maxBytes / (1024 * 1024)).toFixed(2)} MB`,
      "FILE_TOO_LARGE"
    );
  }

  const mediaType = detectMediaType(buffer);

  if (options.allowedMediaTypes && !options.allowedMediaTypes.includes(mediaType)) {
    throw new IngestionError(
      `Media type '${mediaType}' is not permitted by upload policy`,
      "UNSUPPORTED_MEDIA_TYPE"
    );
  }

  // PDF specific encryption and structure check
  if (mediaType === "application/pdf") {
    const rawHead = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("latin1");
    if (!rawHead.startsWith("%PDF-")) {
      throw new IngestionError("Invalid PDF header signature", "CORRUPT_DOCUMENT");
    }

    // Inspect for /Encrypt dictionary
    const rawTail = buffer.subarray(Math.max(0, buffer.length - 8192)).toString("latin1");
    if (rawTail.includes("/Encrypt") || rawHead.includes("/Encrypt")) {
      throw new IngestionError("Encrypted or password-protected PDFs are not supported", "ENCRYPTED_DOCUMENT");
    }
  }

  return mediaType;
}
