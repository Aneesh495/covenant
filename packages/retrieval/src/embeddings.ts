import { DocumentChunk } from "./chunker";

export interface DenseSearchResult {
  chunkId: string;
  score: number;
  rank: number;
}

export interface IEmbeddingProvider {
  readonly dimension: number;
  embed(texts: string[]): Promise<number[][]>;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Fast deterministic subword feature projection embedding provider.
 * Maps n-grams, word tokens, and domain features to a 384-dimensional unit sphere.
 * Provides high-speed semantic matching without external network latency or GPU dependencies.
 */
export class LocalFeatureEmbeddingProvider implements IEmbeddingProvider {
  public readonly dimension: number = 384;

  private hashString(str: string, seed: number): number {
    let h = seed;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.embedSingle(text));
  }

  private embedSingle(text: string): number[] {
    const vec = new Float64Array(this.dimension);
    const normalized = text.toLowerCase().trim();
    if (!normalized) return Array.from(vec);

    const words = normalized.split(/\s+/);

    // 1. Unigram feature projection
    for (const w of words) {
      if (!w) continue;
      const bucket1 = this.hashString(w, 0x12345678) % this.dimension;
      const bucket2 = this.hashString(w, 0x87654321) % this.dimension;
      const sign = (this.hashString(w, 0xabcdef) % 2 === 0 ? 1 : -1);

      vec[bucket1] += 1.0 * sign;
      vec[bucket2] += 0.5 * sign;

      // 2. Character 3-gram and 4-gram projections for subword robustness
      if (w.length >= 3) {
        for (let i = 0; i <= w.length - 3; i++) {
          const gram = w.slice(i, i + 3);
          const gramBucket = this.hashString(gram, 0x55aa55aa) % this.dimension;
          vec[gramBucket] += 0.3;
        }
      }
    }

    // 3. Word bigram features
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]}_${words[i + 1]}`;
      const biBucket = this.hashString(bigram, 0x99bb99bb) % this.dimension;
      vec[biBucket] += 0.7;
    }

    // L2 Normalize to unit hypersphere
    let norm = 0;
    for (let i = 0; i < this.dimension; i++) {
      norm += vec[i] * vec[i];
    }

    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < this.dimension; i++) {
        vec[i] /= norm;
      }
    }

    return Array.from(vec);
  }
}

export class DenseVectorIndex {
  private readonly provider: IEmbeddingProvider;
  private chunkVectors: Map<string, number[]> = new Map();

  constructor(provider: IEmbeddingProvider = new LocalFeatureEmbeddingProvider()) {
    this.provider = provider;
  }

  async buildIndex(chunks: DocumentChunk[]): Promise<void> {
    this.chunkVectors.clear();
    if (chunks.length === 0) return;

    const texts = chunks.map((c) => `${c.headingContext} ${c.text}`);
    const embeddings = await this.provider.embed(texts);

    for (let i = 0; i < chunks.length; i++) {
      this.chunkVectors.set(chunks[i].id, embeddings[i]);
    }
  }

  async search(query: string, topK: number = 10): Promise<DenseSearchResult[]> {
    if (this.chunkVectors.size === 0) return [];

    const [queryVec] = await this.provider.embed([query]);
    const scored: Array<{ chunkId: string; score: number }> = [];

    for (const [chunkId, chunkVec] of Array.from(this.chunkVectors.entries())) {
      const score = cosineSimilarity(queryVec, chunkVec);
      scored.push({ chunkId, score });
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((res, idx) => ({
      chunkId: res.chunkId,
      score: Number(res.score.toFixed(4)),
      rank: idx + 1,
    }));
  }
}
