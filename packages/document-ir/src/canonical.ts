import { BlockNode, PageNode, SourceMapEntry } from "./types";

export interface CanonicalBuildResult {
  canonicalText: string;
  pages: PageNode[];
  sourceMap: SourceMapEntry[];
}

export function normalizeRawText(text: string): string {
  // Normalize Unicode to NFC
  let normalized = text.normalize("NFC");

  // Normalize all newline variations (\r\n, \r) to standard \n
  normalized = normalized.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Replace form feeds and vertical tabs with single newline
  normalized = normalized.replace(/[\f\v]/g, "\n");

  // Replace non-breaking spaces and zero-width spaces with standard space or empty
  normalized = normalized.replace(/[\u00A0\u2007\u202F]/g, " ");
  normalized = normalized.replace(/[\u200B\uFEFF]/g, "");

  return normalized.trim();
}

/**
 * Builds the canonical text string from a list of pages and unindexed block nodes.
 * Assigns exact half-open UTF-16 code unit offsets [canonicalStart, canonicalEnd)
 * to every block and generates the linear source map.
 * Blocks are joined by double newlines for paragraph breaks or single newlines for table rows/list items.
 */
export function buildCanonicalDocument(
  rawPages: Array<{
    pageNumber: number;
    width: number;
    height: number;
    isOcr: boolean;
    columnCount?: number;
    readingOrderConfidence?: number;
    rawBlocks: Array<{
      id: string;
      type: BlockNode["type"];
      text: string;
      rawText?: string;
      level?: number;
      readingOrderIndex: number;
      boundingBox?: BlockNode["boundingBox"];
      confidence: number;
      isOcr: boolean;
      children?: BlockNode[];
      originalByteOffset?: [number, number];
      metadata?: Record<string, unknown>;
    }>;
  }>
): CanonicalBuildResult {
  let canonicalText = "";
  const sourceMap: SourceMapEntry[] = [];
  const pages: PageNode[] = [];

  for (const rawPage of rawPages) {
    const pageBlocks: BlockNode[] = [];

    // Sort blocks by readingOrderIndex
    const sortedBlocks = [...rawPage.rawBlocks].sort((a, b) => a.readingOrderIndex - b.readingOrderIndex);

    for (const rawBlock of sortedBlocks) {
      const normalizedBlockText = normalizeRawText(rawBlock.text);
      if (!normalizedBlockText) continue;

      if (canonicalText.length > 0) {
        // Separate headings and paragraphs with double newline, lists and table elements with single newline
        const separator = rawBlock.type === "list_item" || rawBlock.type === "table_row" || rawBlock.type === "table_cell" ? "\n" : "\n\n";
        canonicalText += separator;
      }

      const canonicalStart = canonicalText.length;
      canonicalText += normalizedBlockText;
      const canonicalEnd = canonicalText.length;

      const blockNode: BlockNode = {
        id: rawBlock.id,
        type: rawBlock.type,
        canonicalStart,
        canonicalEnd,
        text: normalizedBlockText,
        rawText: rawBlock.rawText ?? rawBlock.text,
        level: rawBlock.level,
        readingOrderIndex: rawBlock.readingOrderIndex,
        boundingBox: rawBlock.boundingBox,
        confidence: rawBlock.confidence,
        isOcr: rawBlock.isOcr,
        children: rawBlock.children,
        metadata: rawBlock.metadata,
      };

      pageBlocks.push(blockNode);

      sourceMap.push({
        blockId: rawBlock.id,
        pageNumber: rawPage.pageNumber,
        canonicalStart,
        canonicalEnd,
        originalByteOffset: rawBlock.originalByteOffset,
        boundingBox: rawBlock.boundingBox,
        isOcr: rawBlock.isOcr,
        confidence: rawBlock.confidence,
      });
    }

    pages.push({
      pageNumber: rawPage.pageNumber,
      width: rawPage.width,
      height: rawPage.height,
      blocks: pageBlocks,
      isOcr: rawPage.isOcr,
      columnCount: rawPage.columnCount ?? 1,
      readingOrderConfidence: rawPage.readingOrderConfidence ?? 1.0,
    });
  }

  return {
    canonicalText,
    pages,
    sourceMap,
  };
}
