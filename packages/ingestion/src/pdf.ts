import { BoundingBox, BlockNode } from "@covenant/document-ir";
import { IngestionError } from "@covenant/shared";
import crypto from "crypto";

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  transform: number[];
}

export interface ExtractedPdfPage {
  pageNumber: number;
  width: number;
  height: number;
  isOcr: boolean;
  columnCount: number;
  readingOrderConfidence: number;
  rawBlocks: Array<{
    id: string;
    type: BlockNode["type"];
    text: string;
    rawText?: string;
    level?: number;
    readingOrderIndex: number;
    boundingBox?: BoundingBox;
    confidence: number;
    isOcr: boolean;
  }>;
}

export interface PdfExtractionResult {
  pages: ExtractedPdfPage[];
  pageCount: number;
  hasLowGlyphPages: boolean;
}

/**
 * Detects if a page has multiple columns by analyzing horizontal gap distributions.
 */
export function detectColumns(
  items: PdfTextItem[],
  pageWidth: number
): { columnCount: number; columnBoundaries: number[]; confidence: number } {
  if (items.length < 10) {
    return { columnCount: 1, columnBoundaries: [0, pageWidth], confidence: 0.95 };
  }

  // Count items whose center x falls in the left vs right half
  const midX = pageWidth / 2;
  const gutterWidth = pageWidth * 0.06; // 6% width gutter around center
  const leftItems = items.filter((it) => it.x + it.width < midX - gutterWidth / 2);
  const rightItems = items.filter((it) => it.x > midX + gutterWidth / 2);
  const spanningItems = items.filter(
    (it) => it.x < midX - gutterWidth / 2 && it.x + it.width > midX + gutterWidth / 2
  );

  // If there are substantial items on both left and right and very few spanning items
  const total = items.length;
  if (leftItems.length > total * 0.25 && rightItems.length > total * 0.25 && spanningItems.length < total * 0.1) {
    return {
      columnCount: 2,
      columnBoundaries: [0, midX, pageWidth],
      confidence: 0.88,
    };
  }

  return { columnCount: 1, columnBoundaries: [0, pageWidth], confidence: 0.95 };
}

/**
 * Orders items according to reading order (column-aware, then top-to-bottom, then left-to-right).
 */
export function orderItems(
  items: PdfTextItem[],
  pageWidth: number,
  pageHeight: number,
  columnCount: number
): PdfTextItem[] {
  if (columnCount === 1) {
    // Sort top-to-bottom (in PDF coordinates y is often bottom-up; we normalize so 0 is top)
    return [...items].sort((a, b) => {
      const yDiff = Math.abs(a.y - b.y);
      if (yDiff < 4) {
        return a.x - b.x;
      }
      return b.y - a.y; // PDF y is usually from bottom
    });
  }

  const midX = pageWidth / 2;
  const col1: PdfTextItem[] = [];
  const col2: PdfTextItem[] = [];

  for (const it of items) {
    if (it.x < midX) {
      col1.push(it);
    } else {
      col2.push(it);
    }
  }

  col1.sort((a, b) => (Math.abs(a.y - b.y) < 4 ? a.x - b.x : b.y - a.y));
  col2.sort((a, b) => (Math.abs(a.y - b.y) < 4 ? a.x - b.x : b.y - a.y));

  return [...col1, ...col2];
}

/**
 * Groups lines of text items into paragraphs and headings.
 */
export function groupItemsIntoBlocks(
  items: PdfTextItem[],
  pageWidth: number,
  pageHeight: number,
  pageNumber: number
): ExtractedPdfPage["rawBlocks"] {
  if (items.length === 0) return [];

  const blocks: ExtractedPdfPage["rawBlocks"] = [];
  let currentGroup: PdfTextItem[] = [];
  let blockIndex = 0;

  function flushGroup() {
    if (currentGroup.length === 0) return;

    const text = currentGroup.map((it) => it.str).join(" ").trim();
    if (!text) {
      currentGroup = [];
      return;
    }

    // Determine bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const it of currentGroup) {
      // PDF y=0 is at bottom, convert to top=0 normalized coordinates
      const normX = Math.max(0, Math.min(1, it.x / pageWidth));
      const normY = Math.max(0, Math.min(1, (pageHeight - it.y) / pageHeight));
      const normW = Math.max(0, Math.min(1, it.width / pageWidth));
      const normH = Math.max(0, Math.min(1, it.height / pageHeight));

      if (normX < minX) minX = normX;
      if (normY < minY) minY = normY;
      if (normX + normW > maxX) maxX = normX + normW;
      if (normY + normH > maxY) maxY = normY + normH;
    }

    const bbox: BoundingBox = {
      x: Number(minX.toFixed(4)),
      y: Number(minY.toFixed(4)),
      width: Number(Math.max(0.01, maxX - minX).toFixed(4)),
      height: Number(Math.max(0.01, maxY - minY).toFixed(4)),
    };

    // Heuristics for BlockType and level
    let type: BlockNode["type"] = "paragraph";
    let level: number | undefined = undefined;

    const trimmed = text.trim();
    const isNumberedHeading = /^(SECTION|ARTICLE|\d+(\.\d+)*)\s+/i.test(trimmed);
    const isShortAllCaps = trimmed.length < 80 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
    const isBullet = /^([•\-\*]|\d+\))\s+/.test(trimmed);

    if (isNumberedHeading || isShortAllCaps) {
      type = "heading";
      level = isShortAllCaps ? 1 : 2;
    } else if (isBullet) {
      type = "list_item";
      level = 1;
    }

    blocks.push({
      id: `p${pageNumber}-b${blockIndex++}-${crypto.randomBytes(4).toString("hex")}`,
      type,
      text,
      level,
      readingOrderIndex: blockIndex,
      boundingBox: bbox,
      confidence: 0.95,
      isOcr: false,
    });

    currentGroup = [];
  }

  let lastY: number | null = null;
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;

    if (lastY !== null && Math.abs(lastY - it.y) > 16) {
      // Significant vertical gap: starts new block
      flushGroup();
    }

    currentGroup.push(it);
    lastY = it.y;
  }

  flushGroup();
  return blocks;
}

/**
 * Extracts structured pages from a PDF buffer using pdf-parse and pdf.js page rendering.
 */
export async function extractPdf(pdfBuffer: Buffer): Promise<PdfExtractionResult> {
  const pdfParse = (await import("pdf-parse")).default;

  const rawPagesData: Array<{
    pageNumber: number;
    width: number;
    height: number;
    items: PdfTextItem[];
  }> = [];

  let currentPageNumber = 0;

  const renderPage = (pageData: any) => {
    currentPageNumber++;
    const pageNum = currentPageNumber;

    const viewport = pageData.getViewport({ scale: 1.0 }) || { width: 612, height: 792 };
    const width = viewport.width;
    const height = viewport.height;

    return pageData.getTextContent({ normalizeWhitespace: true }).then((textContent: any) => {
      const items: PdfTextItem[] = [];
      for (const item of textContent.items) {
        if (!item.str) continue;
        items.push({
          str: item.str,
          x: item.transform[4] || 0,
          y: item.transform[5] || 0,
          width: item.width || 0,
          height: item.height || 12,
          transform: item.transform,
        });
      }

      rawPagesData.push({
        pageNumber: pageNum,
        width,
        height,
        items,
      });

      return items.map((it) => it.str).join(" ");
    });
  };

  try {
    const data = await pdfParse(pdfBuffer, {
      pagerender: renderPage,
    });

    const pages: ExtractedPdfPage[] = [];
    let hasLowGlyphPages = false;

    // Detect repeated headers and footers across pages
    const headerCandidates = new Map<string, number>();
    const footerCandidates = new Map<string, number>();

    for (const page of rawPagesData) {
      const charCount = page.items.reduce((acc, it) => acc + it.str.length, 0);
      if (charCount < 50) {
        hasLowGlyphPages = true;
      }

      for (const it of page.items) {
        const normY = (page.height - it.y) / page.height;
        const textKey = it.str.trim();
        if (!textKey || textKey.length < 3) continue;

        if (normY < 0.08) {
          headerCandidates.set(textKey, (headerCandidates.get(textKey) || 0) + 1);
        } else if (normY > 0.92) {
          footerCandidates.set(textKey, (footerCandidates.get(textKey) || 0) + 1);
        }
      }
    }

    const totalPages = rawPagesData.length;
    const isRepeatedHeader = (text: string) => totalPages > 1 && (headerCandidates.get(text.trim()) || 0) >= 2;
    const isRepeatedFooter = (text: string) => totalPages > 1 && (footerCandidates.get(text.trim()) || 0) >= 2;

    for (const page of rawPagesData) {
      const { columnCount, confidence: colConf } = detectColumns(page.items, page.width);
      const orderedItems = orderItems(page.items, page.width, page.height, columnCount);
      const rawBlocks = groupItemsIntoBlocks(orderedItems, page.width, page.height, page.pageNumber);

      // Label repeated headers and footers
      for (const block of rawBlocks) {
        if (isRepeatedHeader(block.text)) {
          block.type = "header";
        } else if (isRepeatedFooter(block.text)) {
          block.type = "footer";
        }
      }

      pages.push({
        pageNumber: page.pageNumber,
        width: page.width,
        height: page.height,
        isOcr: false,
        columnCount,
        readingOrderConfidence: colConf,
        rawBlocks,
      });
    }

    return {
      pages,
      pageCount: data.numpages || pages.length,
      hasLowGlyphPages,
    };
  } catch (err) {
    throw new IngestionError(
      `Failed to parse PDF document: ${err instanceof Error ? err.message : String(err)}`,
      "CORRUPT_DOCUMENT",
      { cause: err }
    );
  }
}
