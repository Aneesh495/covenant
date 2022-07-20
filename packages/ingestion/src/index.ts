export * from "./validation";
export * from "./pdf";
export * from "./docx";
export * from "./ocr";
export * from "./extractor";

import { extractDocument, ExtractionOptions } from "./extractor";
import { detectMediaType } from "./validation";
import { DocumentIR } from "@covenant/document-ir";

export class DocumentIngestionEngine {
  async ingest(params: {
    buffer: Buffer;
    filename: string;
    mediaType?: string;
    options?: ExtractionOptions;
  }): Promise<DocumentIR> {
    return extractDocument(params.buffer, params.filename, params.options);
  }
}

export const SignatureValidator = {
  detectMediaType,
  validateBuffer(buffer: Buffer): { isValid: boolean; mediaType?: string; error?: string } {
    try {
      const mediaType = detectMediaType(buffer);
      return { isValid: true, mediaType };
    } catch (err: any) {
      return { isValid: false, error: err.message };
    }
  },
};
