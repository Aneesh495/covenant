import { describe, it, expect } from "vitest";
import {
  HeadingAwareChunker,
  Bm25Index,
  DenseVectorIndex,
  LocalFeatureEmbeddingProvider,
  ExactTermMatcher,
  reciprocalRankFusion,
  HybridRetrievalEngine,
} from "@covenant/retrieval";
import { buildCanonicalDocument, DocumentIR } from "@covenant/document-ir";

describe("Hybrid Retrieval Engine with BM25, Dense Embeddings, and Exact Term Matching", () => {
  const canonicalBuild = buildCanonicalDocument([
    {
      pageNumber: 1,
      width: 612,
      height: 792,
      isOcr: false,
      rawBlocks: [
        {
          id: "b-head-1",
          type: "heading",
          text: "ARTICLE 4. INDEMNIFICATION AND LIABILITY",
          level: 1,
          readingOrderIndex: 0,
          confidence: 0.99,
          isOcr: false,
        },
        {
          id: "b-liab-clause",
          type: "paragraph",
          text: "Section 4.1. Limitation of Liability. In no event shall Licensor's aggregate liability exceed $500,000.",
          readingOrderIndex: 1,
          confidence: 0.98,
          isOcr: false,
        },
        {
          id: "b-head-2",
          type: "heading",
          text: "ARTICLE 5. TERM AND TERMINATION",
          level: 1,
          readingOrderIndex: 2,
          confidence: 0.99,
          isOcr: false,
        },
        {
          id: "b-term-clause",
          type: "paragraph",
          text: "Section 5.2. Either party may terminate upon 30 days prior written notice in event of material breach.",
          readingOrderIndex: 3,
          confidence: 0.97,
          isOcr: false,
        },
        {
          id: "b-tech-clause",
          type: "paragraph",
          text: "Contractor shall deploy cloud infrastructure using Kubernetes, Docker, and PostgreSQL on AWS.",
          readingOrderIndex: 4,
          confidence: 0.96,
          isOcr: false,
        },
      ],
    },
  ]);

  const testDoc: DocumentIR = {
    id: "doc-retrieval-1",
    versionId: "ver-retrieval-1",
    originalSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    mediaType: "application/pdf",
    extractorVersion: "2.0.0",
    extractedAt: new Date().toISOString(),
    pageCount: 1,
    pages: canonicalBuild.pages,
    canonicalText: canonicalBuild.canonicalText,
    sourceMap: canonicalBuild.sourceMap,
  };

  it("chunks document preserving heading context and assigning stable IDs", () => {
    const chunker = new HeadingAwareChunker({ targetChunkChars: 150 });
    const chunks = chunker.chunkDocument(testDoc);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].id).toContain("chunk-ver-retrieval-1-");
    expect(chunks[0].documentVersionId).toBe(testDoc.versionId);
    expect(chunks.some((c) => c.headingContext.includes("INDEMNIFICATION"))).toBe(true);
  });

  it("scores keyword queries with BM25 inverted index", () => {
    const chunker = new HeadingAwareChunker();
    const chunks = chunker.chunkDocument(testDoc);

    const bm25 = new Bm25Index();
    bm25.buildIndex(chunks);

    const results = bm25.search("liability limitation licensor", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);

    const topChunk = chunks.find((c) => c.id === results[0].chunkId);
    expect(topChunk?.text).toContain("Limitation of Liability");
  });

  it("calculates semantic similarity using DenseVectorIndex", async () => {
    const chunker = new HeadingAwareChunker();
    const chunks = chunker.chunkDocument(testDoc);

    const dense = new DenseVectorIndex(new LocalFeatureEmbeddingProvider());
    await dense.buildIndex(chunks);

    const results = await dense.search("termination notice upon breach", 5);
    expect(results.length).toBeGreaterThan(0);

    const topChunk = chunks.find((c) => c.id === results[0].chunkId);
    expect(topChunk?.text).toContain("terminate");
  });

  it("retrieves exact clause numbers, monetary amounts, and technical skills", () => {
    const chunker = new HeadingAwareChunker();
    const chunks = chunker.chunkDocument(testDoc);

    const exact = new ExactTermMatcher();
    exact.index(chunks);

    // 1. Clause number
    const clauseResults = exact.search("What does Section 4.1 say?", 5);
    expect(clauseResults.length).toBeGreaterThan(0);
    expect(clauseResults[0].termType).toBe("clause_number");

    // 2. Monetary amount
    const amountResults = exact.search("capped at $500,000", 5);
    expect(amountResults.length).toBeGreaterThan(0);
    expect(amountResults[0].termType).toBe("amount");

    // 3. Technical skill
    const skillResults = exact.search("Candidate needs Kubernetes and PostgreSQL experience", 5);
    expect(skillResults.length).toBeGreaterThan(0);
    expect(skillResults[0].termType).toBe("named_skill");
  });

  it("fuses rankings using Reciprocal Rank Fusion", () => {
    const bm25 = [
      { chunkId: "c1", rank: 1 },
      { chunkId: "c2", rank: 2 },
    ];
    const dense = [
      { chunkId: "c2", rank: 1 },
      { chunkId: "c3", rank: 2 },
    ];
    const exact = [
      { chunkId: "c2", rank: 1 },
    ];

    const fused = reciprocalRankFusion(bm25, dense, exact);
    expect(fused.length).toBe(3);
    // c2 appeared in all 3 rankings and had exact match boost, so c2 must rank #1
    expect(fused[0].chunkId).toBe("c2");
    expect(fused[0].rrfScore).toBeGreaterThan(fused[1].rrfScore);
  });

  it("executes end-to-end hybrid retrieval with caching in HybridRetrievalEngine", async () => {
    const engine = new HybridRetrievalEngine();
    await engine.indexDocument(testDoc);

    const results = await engine.search(testDoc.versionId, "Section 4.1 aggregate liability $500,000", 3);
    expect(results.length).toBeGreaterThan(0);

    const topResult = results[0];
    expect(topResult.chunk.text).toContain("$500,000");
    expect(topResult.rrfScore).toBeGreaterThan(0);
  });
});
