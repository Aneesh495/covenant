import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { BlockNode } from "@covenant/document-ir";
import { IngestionError } from "@covenant/shared";
import crypto from "crypto";

export interface ExtractedDocxResult {
  rawBlocks: Array<{
    id: string;
    type: BlockNode["type"];
    text: string;
    rawText?: string;
    level?: number;
    readingOrderIndex: number;
    confidence: number;
    isOcr: boolean;
  }>;
}

const MAX_DECOMPRESSED_RATIO = 100;
const MAX_DECOMPRESSED_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_ENTRIES = 5000;

export async function extractDocx(docxBuffer: Buffer): Promise<ExtractedDocxResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(docxBuffer);
  } catch (err) {
    throw new IngestionError("Corrupt DOCX archive or invalid zip structure", "CORRUPT_DOCUMENT", { cause: err });
  }

  // Security: Check for zip bombs and suspicious remote relationships
  let totalDecompressedSize = 0;
  let entryCount = 0;

  for (const [relativePath, entry] of Object.entries(zip.files)) {
    entryCount++;
    if (entryCount > MAX_ENTRIES) {
      throw new IngestionError("DOCX archive contains too many file entries", "CORRUPT_DOCUMENT");
    }

    // JSZip entry._data gives uncompressed length if available
    const uncompressedSize = (entry as any)._data?.uncompressedSize || 0;
    totalDecompressedSize += uncompressedSize;

    if (totalDecompressedSize > MAX_DECOMPRESSED_BYTES) {
      throw new IngestionError("DOCX uncompressed payload exceeds safe limits", "FILE_TOO_LARGE");
    }
  }

  if (docxBuffer.length > 0 && totalDecompressedSize / docxBuffer.length > MAX_DECOMPRESSED_RATIO) {
    throw new IngestionError("DOCX compression ratio exceeds safe limit (possible decompression bomb)", "FILE_TOO_LARGE");
  }

  const documentXmlEntry = zip.file("word/document.xml");
  if (!documentXmlEntry) {
    throw new IngestionError("DOCX missing word/document.xml", "CORRUPT_DOCUMENT");
  }

  const xmlContent = await documentXmlEntry.async("text");

  // Safe parsing: xmldom does not resolve external entities or fetch network resources
  const parser = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: () => {},
      fatalError: (e) => {
        throw new IngestionError(`XML parse failure in DOCX: ${e}`, "CORRUPT_DOCUMENT");
      },
    },
  });

  const doc = parser.parseFromString(xmlContent, "application/xml");
  const rawBlocks: ExtractedDocxResult["rawBlocks"] = [];
  let blockIndex = 0;

  const bodyElements = doc.getElementsByTagName("w:body");
  if (!bodyElements || bodyElements.length === 0) {
    return { rawBlocks: [] };
  }

  const body = bodyElements[0];

  for (let i = 0; i < body.childNodes.length; i++) {
    const node = body.childNodes[i];
    if (!node || node.nodeType !== 1) continue; // Element node only

    const nodeName = node.nodeName;

    if (nodeName === "w:p") {
      // Paragraph or Heading or List item
      const text = extractTextFromParagraph(node);
      if (!text || !text.trim()) continue;

      let type: BlockNode["type"] = "paragraph";
      let level: number | undefined = undefined;

      // Check for heading style
      const pPr = getChildElement(node, "w:pPr");
      if (pPr) {
        const pStyle = getChildElement(pPr, "w:pStyle");
        if (pStyle) {
          const val = pStyle.getAttribute("w:val") || "";
          const headingMatch = val.match(/Heading(\d)/i);
          if (headingMatch) {
            type = "heading";
            level = parseInt(headingMatch[1], 10);
          } else if (/Title/i.test(val)) {
            type = "heading";
            level = 1;
          }
        }

        // Check for list item (numPr)
        const numPr = getChildElement(pPr, "w:numPr");
        if (numPr && type !== "heading") {
          type = "list_item";
          const ilvl = getChildElement(numPr, "w:ilvl");
          if (ilvl) {
            level = parseInt(ilvl.getAttribute("w:val") || "0", 10) + 1;
          } else {
            level = 1;
          }
        }
      }

      // Check text-based heading heuristic if style was default
      if (type === "paragraph") {
        const trimmed = text.trim();
        if (/^(ARTICLE|SECTION|\d+(\.\d+)*)\s+/i.test(trimmed)) {
          type = "heading";
          level = 2;
        } else if (/^[•\-\*]\s+/.test(trimmed)) {
          type = "list_item";
          level = 1;
        }
      }

      rawBlocks.push({
        id: `docx-b${blockIndex++}-${crypto.randomBytes(4).toString("hex")}`,
        type,
        text: text.trim(),
        level,
        readingOrderIndex: blockIndex,
        confidence: 0.98,
        isOcr: false,
      });
    } else if (nodeName === "w:tbl") {
      // Table extraction: preserve rows and cells
      const tblElem = node as any;
      const rows = tblElem.getElementsByTagName("w:tr");
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const cells = row.getElementsByTagName("w:tc");
        const cellTexts: string[] = [];

        for (let c = 0; c < cells.length; c++) {
          const cell = cells[c];
          const cellText = extractTextFromElement(cell);
          if (cellText) cellTexts.push(cellText.trim());
        }

        if (cellTexts.length > 0) {
          rawBlocks.push({
            id: `docx-t${blockIndex++}-${crypto.randomBytes(4).toString("hex")}`,
            type: "table_row",
            text: cellTexts.join(" | "),
            readingOrderIndex: blockIndex,
            confidence: 0.95,
            isOcr: false,
          });
        }
      }
    }
  }

  return { rawBlocks };
}

function extractTextFromParagraph(pNode: any): string {
  let result = "";
  const rElements = pNode.getElementsByTagName("w:r");
  for (let i = 0; i < rElements.length; i++) {
    const r = rElements[i];
    const tElements = r.getElementsByTagName("w:t");
    for (let j = 0; j < tElements.length; j++) {
      const t = tElements[j];
      result += t.textContent || "";
    }
  }
  return result;
}

function extractTextFromElement(elem: any): string {
  const pElements = elem.getElementsByTagName("w:p");
  if (pElements.length > 0) {
    const paras: string[] = [];
    for (let i = 0; i < pElements.length; i++) {
      const text = extractTextFromParagraph(pElements[i]);
      if (text.trim()) paras.push(text.trim());
    }
    return paras.join(" ");
  }

  const tElements = elem.getElementsByTagName("w:t");
  let result = "";
  for (let i = 0; i < tElements.length; i++) {
    result += tElements[i].textContent || "";
  }
  return result;
}

function getChildElement(parent: any, childName: string): any {
  if (!parent || !parent.childNodes) return null;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i];
    if (child.nodeType === 1 && child.nodeName === childName) {
      return child;
    }
  }
  return null;
}
