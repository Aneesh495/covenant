export interface RankedItem {
  chunkId: string;
  rank: number;
}

export interface FusedSearchResult {
  chunkId: string;
  rrfScore: number;
  bm25Rank?: number;
  denseRank?: number;
  exactRank?: number;
}

export interface RrfOptions {
  k?: number;
  bm25Weight?: number;
  denseWeight?: number;
  exactWeight?: number;
}

export function reciprocalRankFusion(
  bm25Results: RankedItem[],
  denseResults: RankedItem[],
  exactResults: RankedItem[],
  options: RrfOptions = {}
): FusedSearchResult[] {
  const k = options.k ?? 60;
  const wBm25 = options.bm25Weight ?? 1.0;
  const wDense = options.denseWeight ?? 1.0;
  const wExact = options.exactWeight ?? 1.5;

  const scoreMap = new Map<string, { rrfScore: number; bm25Rank?: number; denseRank?: number; exactRank?: number }>();

  // Process BM25 rankings
  for (const item of bm25Results) {
    const current = scoreMap.get(item.chunkId) || { rrfScore: 0 };
    current.rrfScore += wBm25 / (k + item.rank);
    current.bm25Rank = item.rank;
    scoreMap.set(item.chunkId, current);
  }

  // Process Dense rankings
  for (const item of denseResults) {
    const current = scoreMap.get(item.chunkId) || { rrfScore: 0 };
    current.rrfScore += wDense / (k + item.rank);
    current.denseRank = item.rank;
    scoreMap.set(item.chunkId, current);
  }

  // Process Exact Term rankings
  for (const item of exactResults) {
    const current = scoreMap.get(item.chunkId) || { rrfScore: 0 };
    current.rrfScore += wExact / (k + item.rank);
    current.exactRank = item.rank;
    scoreMap.set(item.chunkId, current);
  }

  const sorted = Array.from(scoreMap.entries())
    .sort((a, b) => b[1].rrfScore - a[1].rrfScore);

  return sorted.map(([chunkId, data]) => ({
    chunkId,
    rrfScore: Number(data.rrfScore.toFixed(6)),
    bm25Rank: data.bm25Rank,
    denseRank: data.denseRank,
    exactRank: data.exactRank,
  }));
}
