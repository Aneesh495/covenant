import { DocumentIR } from "@covenant/document-ir";
import { HeadingAwareChunker, DocumentChunk, ChunkingOptions } from "./chunker";
import { Bm25Index } from "./bm25";
import { DenseVectorIndex, IEmbeddingProvider, LocalFeatureEmbeddingProvider } from "./embeddings";
import { ExactTermMatcher } from "./exact_matcher";
import { reciprocalRankFusion, FusedSearchResult, RrfOptions } from "./rrf";
import { CovenantError } from "@covenant/shared";

export interface HybridSearchResult extends FusedSearchResult {
  chunk: DocumentChunk;
}

export interface HybridEngineOptions {
  chunking?: ChunkingOptions;
  embeddingProvider?: IEmbeddingProvider;
  rrfOptions?: RrfOptions;
}

interface IndexedDocumentState {
  versionId: string;
  chunks: DocumentChunk[];
  chunkMap: Map<string, DocumentChunk>;
  bm25: Bm25Index;
  dense: DenseVectorIndex;
  exact: ExactTermMatcher;
  indexedAt: number;
}

export class HybridRetrievalEngine {
  private readonly chunker: HeadingAwareChunker;
  private readonly embeddingProvider: IEmbeddingProvider;
  private readonly rrfOptions: RrfOptions;
  private readonly indexCache: Map<string, IndexedDocumentState> = new Map();

  constructor(options: HybridEngineOptions = {}) {
    this.chunker = new HeadingAwareChunker(options.chunking);
    this.embeddingProvider = options.embeddingProvider ?? new LocalFeatureEmbeddingProvider();
    this.rrfOptions = options.rrfOptions ?? {};
  }

  async indexDocument(doc: DocumentIR): Promise<DocumentChunk[]> {
    const existing = this.indexCache.get(doc.versionId);
    if (existing) {
      return existing.chunks;
    }

    const chunks = this.chunker.chunkDocument(doc);
    const chunkMap = new Map<string, DocumentChunk>();
    for (const c of chunks) {
      chunkMap.set(c.id, c);
    }

    const bm25 = new Bm25Index();
    bm25.buildIndex(chunks);

    const dense = new DenseVectorIndex(this.embeddingProvider);
    await dense.buildIndex(chunks);

    const exact = new ExactTermMatcher();
    exact.index(chunks);

    this.indexCache.set(doc.versionId, {
      versionId: doc.versionId,
      chunks,
      chunkMap,
      bm25,
      dense,
      exact,
      indexedAt: Date.now(),
    });

    return chunks;
  }

  async search(
    versionId: string,
    query: string,
    topK: number = 10
  ): Promise<HybridSearchResult[]> {
    const state = this.indexCache.get(versionId);
    if (!state) {
      throw new CovenantError({
        message: `Document version ${versionId} is not indexed in retrieval engine. Call indexDocument first.`,
        code: "VERSION_NOT_FOUND",
        statusCode: 404,
      });
    }

    // Run retrievers
    const bm25Results = state.bm25.search(query, topK * 2);
    const denseResults = await state.dense.search(query, topK * 2);
    const exactResults = state.exact.search(query, topK * 2);

    const fused = reciprocalRankFusion(bm25Results, denseResults, exactResults, this.rrfOptions);

    const topFused = fused.slice(0, topK);

    return topFused.map((res) => {
      const chunk = state.chunkMap.get(res.chunkId)!;
      return {
        ...res,
        chunk,
      };
    });
  }

  getChunks(versionId: string): DocumentChunk[] {
    const state = this.indexCache.get(versionId);
    return state ? state.chunks : [];
  }

  evict(versionId: string): void {
    this.indexCache.delete(versionId);
  }
}
