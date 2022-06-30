import { describe, it, expect } from "vitest";
import {
  buildCanonicalDocument,
  resolveSpanFromDocument,
  verifyCitationAgainstDocument,
  resolveProposedEvidence,
  serializeDocumentIR,
  deserializeDocumentIR,
  DocumentIR,
} from "@covenant/document-ir";
import { GroundedCitation } from "@covenant/shared";

describe("DocumentIR and Canonical Text Indexing", () => {
  const samplePages = [
    {
      pageNumber: 1,
      width: 612,
      height: 792,
      isOcr: false,
      rawBlocks: [
        {
          id: "b-title",
          type: "heading" as const,
          text: "MASTER SERVICES AGREEMENT",
          level: 1,
          readingOrderIndex: 0,
          confidence: 0.99,
          isOcr: false,
          boundingBox: { x: 0.1, y: 0.05, width: 0.8, height: 0.04 },
        },
        {
          id: "b-intro",
          type: "paragraph" as const,
          text: "This Master Services Agreement is entered into by Alpha Corporation and Beta LLC.",
          readingOrderIndex: 1,
          confidence: 0.98,
          isOcr: false,
          boundingBox: { x: 0.1, y: 0.12, width: 0.8, height: 0.06 },
        },
      ],
    },
    {
      pageNumber: 2,
      width: 612,
      height: 792,
      isOcr: false,
      rawBlocks: [
        {
          id: "b-liability",
          type: "paragraph" as const,
          text: "In no event shall either party's aggregate liability exceed $500,000.",
          readingOrderIndex: 0,
          confidence: 0.97,
          isOcr: false,
          boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.05 },
        },
        {
          id: "b-renewal",
          type: "paragraph" as const,
          text: "This agreement automatically renews for 12 months unless notice is given 30 days prior.",
          readingOrderIndex: 1,
          confidence: 0.96,
          isOcr: false,
          boundingBox: { x: 0.1, y: 0.2, width: 0.8, height: 0.05 },
        },
      ],
    },
  ];

  const canonicalBuild = buildCanonicalDocument(samplePages);
  const sampleDoc: DocumentIR = {
    id: "doc-1",
    versionId: "ver-1",
    originalSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    mediaType: "application/pdf",
    extractorVersion: "1.0.0",
    extractedAt: new Date().toISOString(),
    pageCount: 2,
    pages: canonicalBuild.pages,
    canonicalText: canonicalBuild.canonicalText,
    sourceMap: canonicalBuild.sourceMap,
  };

  it("assigns exact half-open UTF-16 code unit offsets matching JavaScript slice", () => {
    for (const page of sampleDoc.pages) {
      for (const block of page.blocks) {
        const slice = sampleDoc.canonicalText.slice(block.canonicalStart, block.canonicalEnd);
        expect(slice).toBe(block.text);
      }
    }
  });

  it("resolves arbitrary span accurately to primary intersecting source block", () => {
    // Find where '$500,000' is located
    const amountStr = "$500,000";
    const start = sampleDoc.canonicalText.indexOf(amountStr);
    const end = start + amountStr.length;

    const span = resolveSpanFromDocument(sampleDoc, start, end);
    expect(span.blockId).toBe("b-liability");
    expect(span.pageNumber).toBe(2);
    expect(span.text).toBe(amountStr);
  });

  it("validates exact citation matches and rejects mismatched quotes", () => {
    const validCitation: GroundedCitation = {
      id: "cit-1",
      blockId: "b-liability",
      pageNumber: 2,
      startOffset: sampleDoc.canonicalText.indexOf("aggregate liability exceed $500,000"),
      endOffset: sampleDoc.canonicalText.indexOf("aggregate liability exceed $500,000") + "aggregate liability exceed $500,000".length,
      exactQuote: "aggregate liability exceed $500,000",
      confidence: 0.95,
      sourceType: "digital_text",
    };

    const validResult = verifyCitationAgainstDocument(sampleDoc, validCitation);
    expect(validResult.valid).toBe(true);

    const forgedCitation: GroundedCitation = {
      ...validCitation,
      exactQuote: "liability shall be unlimited", // text not in slice
    };

    const forgedResult = verifyCitationAgainstDocument(sampleDoc, forgedCitation);
    expect(forgedResult.valid).toBe(false);
    expect(forgedResult.reason).toContain("Quoted text does not match canonical document slice");
  });

  it("rejects out of bounds offsets", () => {
    const outOfBoundsCitation: GroundedCitation = {
      id: "cit-oob",
      blockId: "b-liability",
      pageNumber: 2,
      startOffset: 99999,
      endOffset: 100050,
      exactQuote: "fake quote",
      confidence: 0.9,
      sourceType: "digital_text",
    };

    const result = verifyCitationAgainstDocument(sampleDoc, outOfBoundsCitation);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("out of document bounds");
  });

  it("resolves proposed quotes to canonical offsets on the server side", () => {
    const resolved = resolveProposedEvidence(sampleDoc, {
      exactQuote: "automatically renews for 12 months",
      blockId: "b-renewal",
    });

    expect(resolved.pageNumber).toBe(2);
    expect(resolved.blockId).toBe("b-renewal");
    expect(sampleDoc.canonicalText.slice(resolved.startOffset, resolved.endOffset)).toBe(
      "automatically renews for 12 months"
    );
  });

  it("serializes and deserializes DocumentIR with schema validation", () => {
    const serialized = serializeDocumentIR(sampleDoc);
    const deserialized = deserializeDocumentIR(serialized);

    expect(deserialized.id).toBe(sampleDoc.id);
    expect(deserialized.canonicalText).toBe(sampleDoc.canonicalText);
    expect(deserialized.sourceMap.length).toBe(sampleDoc.sourceMap.length);
  });
});
