import crypto from "crypto";
import { DocumentIR, buildCanonicalDocument } from "@covenant/document-ir";
import { IngestionError } from "@covenant/shared";
import { validateInputFile, FileValidationOptions } from "./validation";
import { extractPdf } from "./pdf";
import { extractDocx } from "./docx";
import { runOcrOnPdfPage } from "./ocr";

export interface ExtractionOptions extends FileValidationOptions {
  forceOcr?: boolean;
  enableOcrFallback?: boolean;
  documentId?: string;
  versionId?: string;
}

export const EXTRACTOR_VERSION = "2.0.0";

export async function extractDocument(
  buffer: Buffer,
  filename: string,
  options: ExtractionOptions = {}
): Promise<DocumentIR> {
  const mediaType = validateInputFile(buffer, options);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const docId = options.documentId ?? `doc-${crypto.randomUUID()}`;
  const verId = options.versionId ?? `ver-${crypto.randomUUID()}`;

  let rawPages: Array<{
    pageNumber: number;
    width: number;
    height: number;
    isOcr: boolean;
    columnCount?: number;
    readingOrderConfidence?: number;
    rawBlocks: Array<{
      id: string;
      type: any;
      text: string;
      rawText?: string;
      level?: number;
      readingOrderIndex: number;
      boundingBox?: any;
      confidence: number;
      isOcr: boolean;
      children?: any;
      originalByteOffset?: [number, number];
      metadata?: Record<string, unknown>;
    }>;
  }> = [];

  if (mediaType === "application/pdf") {
    if (options.forceOcr) {
      // Force OCR for every page
      // @ts-ignore
      const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const meta = await pdfParse(buffer, { max: 1 });
      const numPages = meta.numpages || 1;
      for (let p = 1; p <= numPages; p++) {
        const ocrPage = await runOcrOnPdfPage(buffer, p);
        rawPages.push(ocrPage);
      }
    } else {
      const pdfResult = await extractPdf(buffer);
      if (pdfResult.hasLowGlyphPages && options.enableOcrFallback) {
        // Run OCR on pages with minimal text
        for (const page of pdfResult.pages) {
          const charCount = page.rawBlocks.reduce((acc, b) => acc + b.text.length, 0);
          if (charCount < 50) {
            const ocrPage = await runOcrOnPdfPage(buffer, page.pageNumber);
            rawPages.push(ocrPage);
          } else {
            rawPages.push(page);
          }
        }
      } else {
        rawPages = pdfResult.pages;
      }
    }
  } else if (mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const docxResult = await extractDocx(buffer);
    rawPages = [
      {
        pageNumber: 1,
        width: 612,
        height: 792,
        isOcr: false,
        columnCount: 1,
        readingOrderConfidence: 0.98,
        rawBlocks: docxResult.rawBlocks,
      },
    ];
  } else if (mediaType === "text/plain" || mediaType === "text/markdown") {
    const textContent = buffer.toString("utf-8");
    const rawLines = textContent.split(/\r?\n\r?\n/);
    const blocks = rawLines
      .map((blk, idx) => {
        const trimmed = blk.trim();
        if (!trimmed) return null;
        let type: any = "paragraph";
        let level: number | undefined = undefined;

        if (trimmed.startsWith("#")) {
          type = "heading";
          const hashes = trimmed.match(/^#+/)?.[0].length || 1;
          level = hashes;
        } else if (/^[•\-\*]\s+/.test(trimmed)) {
          type = "list_item";
          level = 1;
        }

        return {
          id: `txt-b${idx}-${crypto.randomBytes(4).toString("hex")}`,
          type,
          text: trimmed,
          level,
          readingOrderIndex: idx,
          confidence: 1.0,
          isOcr: false,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);

    rawPages = [
      {
        pageNumber: 1,
        width: 612,
        height: 792,
        isOcr: false,
        columnCount: 1,
        readingOrderConfidence: 1.0,
        rawBlocks: blocks,
      },
    ];
  } else {
    throw new IngestionError(`Unsupported media type: ${mediaType}`, "UNSUPPORTED_MEDIA_TYPE");
  }

  const canonicalBuild = buildCanonicalDocument(rawPages);

  return {
    id: docId,
    versionId: verId,
    originalSha256: sha256,
    mediaType,
    extractorVersion: EXTRACTOR_VERSION,
    extractedAt: new Date().toISOString(),
    pageCount: rawPages.length,
    pages: canonicalBuild.pages,
    canonicalText: canonicalBuild.canonicalText,
    sourceMap: canonicalBuild.sourceMap,
    metadata: {
      originalFilename: filename,
      fileSize: buffer.length,
    },
  };
}
