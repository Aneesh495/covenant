import { describe, it, expect } from "vitest";
import {
  detectMediaType,
  validateInputFile,
  extractDocument,
  detectColumns,
  orderItems,
  parseTesseractTsv,
} from "@covenant/ingestion";
import { IngestionError } from "@covenant/shared";
import JSZip from "jszip";

describe("Document Ingestion and File Validation", () => {
  it("detects valid PDF and DOCX signatures", () => {
    const fakePdf = Buffer.from("%PDF-1.7\n%some content");
    expect(detectMediaType(fakePdf)).toBe("application/pdf");

    const fakeDocx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    expect(detectMediaType(fakeDocx)).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    const fakeText = Buffer.from("Hello world, this is a plain text file.");
    expect(detectMediaType(fakeText)).toBe("text/plain");
  });

  it("rejects empty files with typed IngestionError", () => {
    const emptyBuf = Buffer.alloc(0);
    expect(() => validateInputFile(emptyBuf)).toThrow(IngestionError);
    try {
      validateInputFile(emptyBuf);
    } catch (err: any) {
      expect(err.code).toBe("CORRUPT_DOCUMENT");
    }
  });

  it("rejects files exceeding configured size limit", () => {
    const largeBuf = Buffer.alloc(1024 * 1024 * 5); // 5MB
    expect(() => validateInputFile(largeBuf, { maxSizeBytes: 1024 * 1024 * 2 })).toThrow(
      IngestionError
    );
  });

  it("rejects encrypted PDFs with typed ENCRYPTED_DOCUMENT error", () => {
    const encryptedPdf = Buffer.from("%PDF-1.5\n1 0 obj\n<< /Encrypt 2 0 R >>\nendobj\n%%EOF");
    expect(() => validateInputFile(encryptedPdf)).toThrow(IngestionError);
    try {
      validateInputFile(encryptedPdf);
    } catch (err: any) {
      expect(err.code).toBe("ENCRYPTED_DOCUMENT");
    }
  });

  it("extracts plain text and markdown documents into valid DocumentIR", async () => {
    const mdContent = Buffer.from(
      "# NON-DISCLOSURE AGREEMENT\n\nThis agreement is between Company A and Company B.\n\n- Term is 2 years\n- Governing law is New York\n\n## Obligations\n\nConfidentiality shall be preserved."
    );

    const docIr = await extractDocument(mdContent, "agreement.md");
    expect(docIr.pageCount).toBe(1);
    expect(docIr.canonicalText).toContain("NON-DISCLOSURE AGREEMENT");
    expect(docIr.canonicalText).toContain("Confidentiality shall be preserved.");
    expect(docIr.pages[0].blocks.length).toBeGreaterThan(3);

    const heading = docIr.pages[0].blocks[0];
    expect(heading.type).toBe("heading");
    expect(heading.text).toBe("# NON-DISCLOSURE AGREEMENT");
  });

  it("extracts structured DOCX packages with headings, paragraphs, and tables", async () => {
    const zip = new JSZip();
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>EMPLOYMENT AGREEMENT</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>This agreement is entered into by Employer and Employee.</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Role</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Salary</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Staff Engineer</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>$220,000</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

    zip.file("word/document.xml", documentXml);
    const docxBuf = await zip.generateAsync({ type: "nodebuffer" });

    const docIr = await extractDocument(docxBuf, "employment.docx");
    expect(docIr.mediaType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(docIr.canonicalText).toContain("EMPLOYMENT AGREEMENT");
    expect(docIr.canonicalText).toContain("Staff Engineer | $220,000");

    const headingBlock = docIr.pages[0].blocks.find((b) => b.text === "EMPLOYMENT AGREEMENT");
    expect(headingBlock).toBeDefined();
    expect(headingBlock?.type).toBe("heading");

    const tableRow = docIr.pages[0].blocks.find((b) => b.type === "table_row");
    expect(tableRow).toBeDefined();
  });

  it("detects two-column layouts and orders items column-first", () => {
    const pageWidth = 600;
    const pageHeight = 800;

    // Simulate 20 items: 10 on the left (x: 50..200), 10 on the right (x: 350..500)
    const items = [
      { str: "Left 1", x: 60, y: 700, width: 80, height: 12, transform: [] },
      { str: "Right 1", x: 360, y: 700, width: 80, height: 12, transform: [] },
      { str: "Left 2", x: 60, y: 650, width: 80, height: 12, transform: [] },
      { str: "Right 2", x: 360, y: 650, width: 80, height: 12, transform: [] },
      { str: "Left 3", x: 60, y: 600, width: 80, height: 12, transform: [] },
      { str: "Right 3", x: 360, y: 600, width: 80, height: 12, transform: [] },
      { str: "Left 4", x: 60, y: 550, width: 80, height: 12, transform: [] },
      { str: "Right 4", x: 360, y: 550, width: 80, height: 12, transform: [] },
      { str: "Left 5", x: 60, y: 500, width: 80, height: 12, transform: [] },
      { str: "Right 5", x: 360, y: 500, width: 80, height: 12, transform: [] },
    ];

    const detected = detectColumns(items, pageWidth);
    expect(detected.columnCount).toBe(2);
    expect(detected.confidence).toBeGreaterThanOrEqual(0.85);

    const ordered = orderItems(items, pageWidth, pageHeight, 2);
    // All left items should come before right items
    const leftIndices = ordered.map((it, idx) => (it.str.startsWith("Left") ? idx : -1)).filter((i) => i >= 0);
    const rightIndices = ordered.map((it, idx) => (it.str.startsWith("Right") ? idx : -1)).filter((i) => i >= 0);

    expect(Math.max(...leftIndices)).toBeLessThan(Math.min(...rightIndices));
  });

  it("parses Tesseract TSV output into OCR blocks with confidence and bounding boxes", () => {
    const sampleTsv = `level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext
1\t1\t0\t0\t0\t0\t0\t0\t612\t792\t-1\t
2\t1\t1\t0\t0\t0\t50\t100\t500\t40\t-1\t
3\t1\t1\t1\t0\t0\t50\t100\t500\t40\t-1\t
4\t1\t1\t1\t1\t0\t50\t100\t500\t20\t-1\t
5\t1\t1\t1\t1\t1\t50\t100\t120\t20\t92\tCONFIDENTIAL
5\t1\t1\t1\t1\t2\t180\t100\t100\t20\t88\tDISCLOSURE`;

    const ocrPage = parseTesseractTsv(sampleTsv, 1);
    expect(ocrPage.isOcr).toBe(true);
    expect(ocrPage.rawBlocks.length).toBe(1);
    const block = ocrPage.rawBlocks[0];
    expect(block.text).toBe("CONFIDENTIAL DISCLOSURE");
    expect(block.confidence).toBeCloseTo(0.9, 1);
    expect(block.isOcr).toBe(true);
    expect(block.boundingBox).toBeDefined();
  });
});
