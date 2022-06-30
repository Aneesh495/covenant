import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { BoundingBox, BlockNode } from "@covenant/document-ir";
import { IngestionError } from "@covenant/shared";

const execFileAsync = promisify(execFile);

export interface OcrWord {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number; // 0.0 to 1.0
  lineNum: number;
  blockNum: number;
}

export interface ExtractedOcrPage {
  pageNumber: number;
  width: number;
  height: number;
  isOcr: true;
  columnCount: number;
  readingOrderConfidence: number;
  rawBlocks: Array<{
    id: string;
    type: BlockNode["type"];
    text: string;
    level?: number;
    readingOrderIndex: number;
    boundingBox?: BoundingBox;
    confidence: number;
    isOcr: true;
  }>;
}

/**
 * Runs OCR on a specific page of a PDF buffer using pdftoppm and tesseract.
 */
export async function runOcrOnPdfPage(
  pdfBuffer: Buffer,
  pageNumber: number
): Promise<ExtractedOcrPage> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "covenant-ocr-"));
  const pdfPath = path.join(tmpDir, `input-${pageNumber}.pdf`);
  const imagePrefix = path.join(tmpDir, `page-${pageNumber}`);

  try {
    fs.writeFileSync(pdfPath, pdfBuffer);

    // Rasterize page to PNG at 300 DPI: pdftoppm -png -r 300 -f <page> -l <page> <pdf> <prefix>
    await execFileAsync("pdftoppm", [
      "-png",
      "-r",
      "300",
      "-f",
      String(pageNumber),
      "-l",
      String(pageNumber),
      pdfPath,
      imagePrefix,
    ]);

    // Find the generated image file (e.g. page-1-1.png or page-1-01.png)
    const files = fs.readdirSync(tmpDir);
    const pngFile = files.find((f) => f.startsWith(`page-${pageNumber}`) && f.endsWith(".png"));

    if (!pngFile) {
      throw new IngestionError(`Failed to rasterize PDF page ${pageNumber}`, "CORRUPT_DOCUMENT");
    }

    const pngPath = path.join(tmpDir, pngFile);

    // Run Tesseract to extract TSV with bounding boxes and confidence:
    // tesseract <image> stdout -l eng tsv
    const { stdout: tsvOutput } = await execFileAsync("tesseract", [
      pngPath,
      "stdout",
      "-l",
      "eng",
      "tsv",
    ]);

    return parseTesseractTsv(tsvOutput, pageNumber);
  } catch (err) {
    throw new IngestionError(
      `OCR extraction failed for page ${pageNumber}: ${err instanceof Error ? err.message : String(err)}`,
      "CORRUPT_DOCUMENT",
      { cause: err }
    );
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Parses Tesseract TSV output into structured blocks with bounding boxes and confidence.
 */
export function parseTesseractTsv(tsvContent: string, pageNumber: number): ExtractedOcrPage {
  const lines = tsvContent.split("\n");
  if (lines.length < 2) {
    return {
      pageNumber,
      width: 612,
      height: 792,
      isOcr: true,
      columnCount: 1,
      readingOrderConfidence: 0.85,
      rawBlocks: [],
    };
  }

  // Header: level page_num block_num par_num line_num word_num left top width height conf text
  const words: OcrWord[] = [];
  let pageWidth = 612;
  let pageHeight = 792;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols.length < 12) continue;

    const level = parseInt(cols[0], 10);
    const left = parseInt(cols[6], 10);
    const top = parseInt(cols[7], 10);
    const width = parseInt(cols[8], 10);
    const height = parseInt(cols[9], 10);
    const conf = parseFloat(cols[10]);
    const text = cols[11]?.trim();

    // Level 1 is the page boundary
    if (level === 1) {
      if (width > 0) pageWidth = width;
      if (height > 0) pageHeight = height;
    }

    // Level 5 is word
    if (level === 5 && text && conf > 0) {
      words.push({
        text,
        left,
        top,
        width,
        height,
        confidence: Math.max(0, Math.min(1, conf / 100)),
        lineNum: parseInt(cols[4], 10),
        blockNum: parseInt(cols[2], 10),
      });
    }
  }

  if (words.length === 0) {
    return {
      pageNumber,
      width: pageWidth,
      height: pageHeight,
      isOcr: true,
      columnCount: 1,
      readingOrderConfidence: 0.85,
      rawBlocks: [],
    };
  }

  // Group words by blockNum and lineNum into paragraphs
  const blockGroups = new Map<number, OcrWord[]>();
  for (const w of words) {
    const list = blockGroups.get(w.blockNum) || [];
    list.push(w);
    blockGroups.set(w.blockNum, list);
  }

  const rawBlocks: ExtractedOcrPage["rawBlocks"] = [];
  let blockIndex = 0;

  for (const [blockNum, groupWords] of Array.from(blockGroups.entries())) {
    const text = groupWords.map((w: OcrWord) => w.text).join(" ").trim();
    if (!text) continue;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let totalConf = 0;

    for (const w of groupWords) {
      if (w.left < minX) minX = w.left;
      if (w.top < minY) minY = w.top;
      if (w.left + w.width > maxX) maxX = w.left + w.width;
      if (w.top + w.height > maxY) maxY = w.top + w.height;
      totalConf += w.confidence;
    }

    const bbox: BoundingBox = {
      x: Number((minX / pageWidth).toFixed(4)),
      y: Number((minY / pageHeight).toFixed(4)),
      width: Number(((maxX - minX) / pageWidth).toFixed(4)),
      height: Number(((maxY - minY) / pageHeight).toFixed(4)),
    };

    const meanConf = Number((totalConf / groupWords.length).toFixed(3));

    let type: BlockNode["type"] = "paragraph";
    let level: number | undefined = undefined;

    const trimmed = text.trim();
    if (/^(SECTION|ARTICLE|\d+(\.\d+)*)\s+/i.test(trimmed)) {
      type = "heading";
      level = 2;
    } else if (/^[•\-\*]\s+/.test(trimmed)) {
      type = "list_item";
      level = 1;
    }

    rawBlocks.push({
      id: `ocr-p${pageNumber}-b${blockIndex++}-${crypto.randomBytes(4).toString("hex")}`,
      type,
      text,
      level,
      readingOrderIndex: blockIndex,
      boundingBox: bbox,
      confidence: meanConf,
      isOcr: true,
    });
  }

  return {
    pageNumber,
    width: pageWidth,
    height: pageHeight,
    isOcr: true,
    columnCount: 1,
    readingOrderConfidence: 0.85,
    rawBlocks,
  };
}
