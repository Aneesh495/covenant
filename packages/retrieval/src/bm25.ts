import { DocumentChunk } from "./chunker";

export interface Bm25SearchResult {
  chunkId: string;
  score: number;
  rank: number;
}

const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "as", "at", "be", "because", "been", "before", "being", "below",
  "between", "both", "but", "by", "could", "did", "do", "does", "doing", "down",
  "during", "each", "few", "for", "from", "further", "had", "has", "have", "having",
  "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i",
  "if", "in", "into", "is", "it", "its", "itself", "just", "me", "more", "most",
  "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once", "only",
  "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same",
  "she", "should", "so", "some", "such", "than", "that", "the", "their", "theirs",
  "them", "themselves", "then", "there", "these", "they", "this", "those", "through",
  "to", "too", "under", "until", "up", "very", "was", "we", "were", "what", "when",
  "where", "which", "while", "who", "whom", "why", "with", "would", "you", "your",
  "yours", "yourself", "yourselves"
]);

export function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\$\-\.]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

export class Bm25Index {
  private readonly k1: number;
  private readonly b: number;
  private docCount: number = 0;
  private avgDocLength: number = 0;
  private docLengths: Map<string, number> = new Map();
  private invertedIndex: Map<string, Array<{ chunkId: string; tf: number }>> = new Map();

  constructor(k1: number = 1.5, b: number = 0.75) {
    this.k1 = k1;
    this.b = b;
  }

  buildIndex(chunks: DocumentChunk[]): void {
    this.docCount = chunks.length;
    this.docLengths.clear();
    this.invertedIndex.clear();

    if (this.docCount === 0) {
      this.avgDocLength = 0;
      return;
    }

    let totalWords = 0;

    for (const chunk of chunks) {
      const fullText = `${chunk.headingContext} ${chunk.text}`;
      const tokens = tokenizeText(fullText);
      const len = tokens.length;
      this.docLengths.set(chunk.id, len);
      totalWords += len;

      const termCounts = new Map<string, number>();
      for (const token of tokens) {
        termCounts.set(token, (termCounts.get(token) || 0) + 1);
      }

      for (const [term, tf] of Array.from(termCounts.entries())) {
        const postingList = this.invertedIndex.get(term) || [];
        postingList.push({ chunkId: chunk.id, tf });
        this.invertedIndex.set(term, postingList);
      }
    }

    this.avgDocLength = totalWords / this.docCount;
  }

  search(query: string, topK: number = 10): Bm25SearchResult[] {
    const queryTokens = tokenizeText(query);
    if (queryTokens.length === 0 || this.docCount === 0) {
      return [];
    }

    const scores = new Map<string, number>();

    for (const term of queryTokens) {
      const postings = this.invertedIndex.get(term);
      if (!postings) continue;

      const df = postings.length;
      // Okapi BM25 IDF with smoothing
      const idf = Math.log((this.docCount - df + 0.5) / (df + 0.5) + 1);

      for (const { chunkId, tf } of postings) {
        const docLen = this.docLengths.get(chunkId) || this.avgDocLength;
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / (this.avgDocLength || 1)));
        const termScore = idf * (numerator / denominator);

        scores.set(chunkId, (scores.get(chunkId) || 0) + termScore);
      }
    }

    const sorted = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK);

    return sorted.map(([chunkId, score], idx) => ({
      chunkId,
      score: Number(score.toFixed(4)),
      rank: idx + 1,
    }));
  }
}
