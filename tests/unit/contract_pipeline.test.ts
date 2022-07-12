import { describe, it, expect } from "vitest";
import {
  ClauseSegmenter,
  EntityExtractor,
  ObligationExtractor,
  VersionComparator,
  ContractReviewPipeline,
} from "@covenant/contract-pipeline";
import { DocumentIR } from "@covenant/document-ir";
import { NdaPlaybook } from "@covenant/policies";

function buildTestDocument(blocks: Array<{ text: string; type?: "paragraph" | "heading" }>): DocumentIR {
  let offset = 0;
  const canonicalParts: string[] = [];
  const irBlocks = blocks.map((b, idx) => {
    const text = b.text;
    const start = offset;
    const end = start + text.length;
    offset = end + 2; // +2 for double newline
    canonicalParts.push(text);

    return {
      id: `blk-${idx + 1}`,
      type: b.type || (text.startsWith("SECTION") || text.startsWith("ARTICLE") || /^[0-9]\./.test(text) ? "heading" : "paragraph"),
      canonicalStart: start,
      canonicalEnd: end,
      text,
      readingOrderIndex: idx,
      confidence: 0.98,
      isOcr: false,
    };
  });

  const canonicalText = canonicalParts.join("\n\n");

  return {
    id: "doc-test-contract-1",
    versionId: "v1",
    originalSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    mediaType: "application/pdf",
    extractorVersion: "covenant-pdf-1.0",
    extractedAt: new Date().toISOString(),
    pageCount: 1,
    pages: [
      {
        pageNumber: 1,
        width: 612,
        height: 792,
        isOcr: false,
        blocks: irBlocks,
      },
    ],
    canonicalText,
    sourceMap: irBlocks.map((b) => ({
      blockId: b.id,
      pageNumber: 1,
      canonicalStart: b.canonicalStart,
      canonicalEnd: b.canonicalEnd,
      isOcr: false,
      confidence: 0.98,
    })),
  };
}

describe("Contract Intelligence Pipeline", () => {
  const sampleContractBlocks = [
    {
      text: 'This Mutual Non-Disclosure Agreement (the "Agreement") is entered into as of January 15, 2026, by and between Alpha Corp, a Delaware corporation ("Disclosing Party"), and Beta Technologies LLC, a California limited liability company ("Receiving Party").',
      type: "paragraph" as const,
    },
    {
      text: "SECTION 1. DEFINITION OF CONFIDENTIAL INFORMATION",
      type: "heading" as const,
    },
    {
      text: '"Confidential Information" shall mean all proprietary technical, financial, and business data disclosed by either party to the other party.',
      type: "paragraph" as const,
    },
    {
      text: "1.1 Exclusions from Confidential Information",
      type: "heading" as const,
    },
    {
      text: "Confidential Information shall not include information that is publicly known or already known to the Receiving Party without breach of this Agreement.",
      type: "paragraph" as const,
    },
    {
      text: "SECTION 2. CONFIDENTIALITY AND NON-USE OBLIGATIONS",
      type: "heading" as const,
    },
    {
      text: "Each party shall hold all Confidential Information in strict confidence and shall not disclose such information to any third party for a period of two (2) years.",
      type: "paragraph" as const,
    },
    {
      text: "SECTION 3. TERMINATION AND RETURN OF MATERIALS",
      type: "heading" as const,
    },
    {
      text: "Either party may terminate this Agreement upon giving thirty (30) days written notice. Upon termination, Receiving Party shall return or certify destruction of all materials.",
      type: "paragraph" as const,
    },
    {
      text: "SECTION 4. LIMITATION OF LIABILITY",
      type: "heading" as const,
    },
    {
      text: "In no event shall either party's aggregate liability exceed $500,000, except for gross negligence, willful misconduct, or breach of confidentiality obligations.",
      type: "paragraph" as const,
    },
    {
      text: "SECTION 5. GOVERNING LAW",
      type: "heading" as const,
    },
    {
      text: "This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware.",
      type: "paragraph" as const,
    },
  ];

  it("segments contract document into hierarchical clause tree", () => {
    const doc = buildTestDocument(sampleContractBlocks);
    const segmenter = new ClauseSegmenter();
    const clauses = segmenter.segmentDocument(doc);

    expect(clauses.length).toBeGreaterThanOrEqual(6);

    const preamble = clauses.find((c) => c.category === "preamble");
    expect(preamble).toBeDefined();
    expect(preamble?.heading).toBe("Preamble");

    const sec1 = clauses.find((c) => c.clauseNumber === "1");
    expect(sec1).toBeDefined();
    expect(sec1?.level).toBe(1);

    const sub1_1 = clauses.find((c) => c.clauseNumber === "1.1");
    expect(sub1_1).toBeDefined();
    expect(sub1_1?.level).toBeGreaterThan(1);
    expect(sub1_1?.parentId).toBe(sec1?.id);
    expect(sec1?.childClauseIds).toContain(sub1_1?.id);

    const sec4 = clauses.find((c) => c.clauseNumber === "4");
    expect(sec4?.category).toBe("liability_limitation");
  });

  it("extracts parties, defined terms, numeric thresholds, and governing law", () => {
    const doc = buildTestDocument(sampleContractBlocks);
    const segmenter = new ClauseSegmenter();
    const clauses = segmenter.segmentDocument(doc);
    const extractor = new EntityExtractor();

    const parties = extractor.extractParties(doc, clauses);
    expect(parties.length).toBeGreaterThanOrEqual(2);
    expect(parties.some((p) => p.name.includes("Alpha Corp"))).toBe(true);
    expect(parties.some((p) => p.name.includes("Beta Technologies"))).toBe(true);

    const terms = extractor.extractDefinedTerms(doc, clauses);
    expect(terms.length).toBeGreaterThan(0);
    expect(terms.some((t) => t.term === "Confidential Information")).toBe(true);

    const govLaw = extractor.extractGoverningLaw(doc, clauses);
    expect(govLaw).toBeDefined();
    expect(govLaw?.jurisdiction).toContain("Delaware");

    const fullText = doc.canonicalText;
    const numerics = extractor.extractNumericQuantities(fullText, 0);
    expect(numerics.notice_period_days?.value).toBe(30);
    expect(numerics.liability_cap_usd?.value).toBe(500000);
  });

  it("extracts contractual obligations, modalities, and bilateral symmetry", () => {
    const doc = buildTestDocument(sampleContractBlocks);
    const segmenter = new ClauseSegmenter();
    const clauses = segmenter.segmentDocument(doc);
    const oblExtractor = new ObligationExtractor();

    const obligations = oblExtractor.extractObligations(doc, clauses);
    expect(obligations.length).toBeGreaterThan(0);

    const shallObligations = obligations.filter((o) => o.modality === "shall");
    expect(shallObligations.length).toBeGreaterThan(0);

    const negativeCovenant = obligations.find((o) => o.modality === "shall_not");
    expect(negativeCovenant).toBeDefined();

    const mutualObl = obligations.find((o) => o.isBilateral);
    expect(mutualObl).toBeDefined();

    const policyEntities = oblExtractor.toPolicyEntities(clauses, obligations);
    expect(policyEntities.length).toBe(clauses.length);
    const sec4Entity = policyEntities.find((e) => e.category === "liability_limitation");
    expect(sec4Entity?.exceptions).toBeDefined();
    expect(sec4Entity?.exceptions?.some((ex) => ex.includes("gross negligence"))).toBe(true);
  });

  it("compares contract revisions detecting identical, modified, added, deleted, and numeric shifts", () => {
    const docV1 = buildTestDocument(sampleContractBlocks);

    // Create modified V2 with:
    // - Notice period changed from 30 days to 14 days
    // - Discretionary modality shift in termination
    // - One clause added (Audit Rights)
    // - One clause removed (Governing Law)
    const modifiedBlocks = [
      sampleContractBlocks[0],
      sampleContractBlocks[1],
      sampleContractBlocks[2],
      sampleContractBlocks[3],
      sampleContractBlocks[4],
      sampleContractBlocks[5],
      sampleContractBlocks[6],
      {
        text: "SECTION 3. TERMINATION AND RETURN OF MATERIALS",
        type: "heading" as const,
      },
      {
        text: "Either party may terminate this Agreement upon giving fourteen (14) days written notice. Upon termination, Receiving Party may return materials if requested.",
        type: "paragraph" as const,
      },
      sampleContractBlocks[9],
      sampleContractBlocks[10],
      {
        text: "SECTION 5. AUDIT RIGHTS",
        type: "heading" as const,
      },
      {
        text: "Disclosing Party shall have the right to audit Receiving Party's records once per calendar year.",
        type: "paragraph" as const,
      },
    ];

    const docV2 = buildTestDocument(modifiedBlocks);
    const comparator = new VersionComparator();
    const comparison = comparator.compareContracts(docV1, docV2);

    expect(comparison.alignments.length).toBeGreaterThan(0);
    expect(comparison.summary.totalClausesBase).toBeGreaterThan(0);
    expect(comparison.summary.totalClausesTarget).toBeGreaterThan(0);

    // Should detect added audit clause
    const addedAudit = comparison.alignments.find((a) => a.alignmentType === "added");
    expect(addedAudit).toBeDefined();
    expect(addedAudit?.targetClause?.heading).toContain("AUDIT");

    // Should detect deleted governing law clause
    const deletedGov = comparison.alignments.find((a) => a.alignmentType === "deleted");
    expect(deletedGov).toBeDefined();
    expect(deletedGov?.baseClause?.heading).toContain("GOVERNING");

    // Should detect modified termination clause with numeric shift
    const modifiedTerm = comparison.alignments.find(
      (a) => a.baseClause?.clauseNumber === "3" && a.alignmentType === "modified"
    );
    expect(modifiedTerm).toBeDefined();
    expect(modifiedTerm?.numericChanges.length).toBeGreaterThan(0);
    expect(modifiedTerm?.numericChanges[0].oldValue).toBe(30);
    expect(modifiedTerm?.numericChanges[0].newValue).toBe(14);
    expect(modifiedTerm?.tokenDiffs.some((d) => d.op === "delete" && d.token.includes("thirty"))).toBe(true);
    expect(modifiedTerm?.tokenDiffs.some((d) => d.op === "insert" && d.token.includes("fourteen"))).toBe(true);
  });

  it("runs end-to-end ContractReviewPipeline generating verified grounded findings", () => {
    const doc = buildTestDocument(sampleContractBlocks);
    const pipeline = new ContractReviewPipeline();

    const result = pipeline.analyzeContract(doc, { playbook: NdaPlaybook });

    expect(result.documentId).toBe(doc.id);
    expect(result.entityGraph.parties.length).toBeGreaterThanOrEqual(2);
    expect(result.summary.totalClauses).toBeGreaterThanOrEqual(5);
    expect(result.summary.totalObligations).toBeGreaterThan(0);

    // Citations must match exact slices in document text
    for (const f of result.findings) {
      for (const cit of f.citations) {
        if (cit.exactQuote) {
          const slice = doc.canonicalText.slice(cit.startOffset, cit.endOffset);
          expect(slice).toBe(cit.exactQuote);
        }
      }
    }
  });
});
