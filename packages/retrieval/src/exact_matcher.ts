import { DocumentChunk } from "./chunker";

export interface ExactTermMatch {
  chunkId: string;
  matchedTerm: string;
  termType: "clause_number" | "amount" | "duration" | "date" | "named_skill" | "verbatim";
  score: number;
  rank: number;
}

const CLAUSE_PATTERN = /(?:section|article|clause|paragraph|§)\s*(\d+(\.\d+)*(\([a-zA-Z0-9]+\))*)/gi;
const AMOUNT_PATTERN = /(?:\$|€|£|USD|EUR|GBP)\s*[\d,]+(?:\.\d+)?(?:\s*(?:k|m|million|billion|thousand))?/gi;
const DURATION_PATTERN = /\b\d+\s*(?:business\s*|calendar\s*)?(?:days?|months?|years?|weeks?|hours?)\b/gi;
const DATE_PATTERN = /\b(?:\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?)\b/gi;

const COMMON_SKILLS = new Set([
  "react", "node.js", "typescript", "javascript", "python", "go", "golang", "rust",
  "postgresql", "postgres", "sql", "mongodb", "docker", "kubernetes", "k8s", "aws",
  "gcp", "azure", "ci/cd", "graphql", "rest", "nextflow", "bioinformatics", "redis",
  "kafka", "spark", "hadoop", "pytorch", "tensorflow", "fastapi", "django", "flask",
  "linux", "git", "dbt", "bigquery", "airflow", "terraform"
]);

export class ExactTermMatcher {
  private chunks: DocumentChunk[] = [];

  index(chunks: DocumentChunk[]): void {
    this.chunks = chunks;
  }

  search(query: string, topK: number = 10): ExactTermMatch[] {
    if (this.chunks.length === 0 || !query.trim()) return [];

    const extractedTerms: Array<{ term: string; type: ExactTermMatch["termType"] }> = [];

    // Extract clause patterns from query
    let match: RegExpExecArray | null;
    const clauseRegex = new RegExp(CLAUSE_PATTERN);
    while ((match = clauseRegex.exec(query)) !== null) {
      extractedTerms.push({ term: match[0].toLowerCase(), type: "clause_number" });
    }

    // Extract amount patterns
    const amountRegex = new RegExp(AMOUNT_PATTERN);
    while ((match = amountRegex.exec(query)) !== null) {
      extractedTerms.push({ term: match[0].toLowerCase(), type: "amount" });
    }

    // Extract duration patterns
    const durationRegex = new RegExp(DURATION_PATTERN);
    while ((match = durationRegex.exec(query)) !== null) {
      extractedTerms.push({ term: match[0].toLowerCase(), type: "duration" });
    }

    // Extract date patterns
    const dateRegex = new RegExp(DATE_PATTERN);
    while ((match = dateRegex.exec(query)) !== null) {
      extractedTerms.push({ term: match[0].toLowerCase(), type: "date" });
    }

    // Extract known technical skills
    const words = query.toLowerCase().split(/\s+/);
    for (const word of words) {
      const cleanWord = word.replace(/[^\w\.\-\/]/g, "");
      if (COMMON_SKILLS.has(cleanWord)) {
        extractedTerms.push({ term: cleanWord, type: "named_skill" });
      }
    }

    // If query has exact quotes like "liability exceed $500,000"
    const quoteMatches = query.match(/"([^"]+)"/);
    if (quoteMatches) {
      extractedTerms.push({ term: quoteMatches[1].toLowerCase(), type: "verbatim" });
    }

    if (extractedTerms.length === 0) {
      return [];
    }

    const chunkScores = new Map<string, { term: string; type: ExactTermMatch["termType"]; score: number }>();

    for (const chunk of this.chunks) {
      const chunkTextLower = `${chunk.headingContext} ${chunk.text}`.toLowerCase();

      for (const { term, type } of extractedTerms) {
        if (chunkTextLower.includes(term)) {
          const current = chunkScores.get(chunk.id);
          const termScore = type === "verbatim" ? 3.0 : type === "clause_number" ? 2.5 : type === "amount" ? 2.0 : 1.5;
          const newScore = (current?.score || 0) + termScore;
          chunkScores.set(chunk.id, { term, type, score: newScore });
        }
      }
    }

    const sorted = Array.from(chunkScores.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, topK);

    return sorted.map(([chunkId, info], idx) => ({
      chunkId,
      matchedTerm: info.term,
      termType: info.type,
      score: Number(info.score.toFixed(2)),
      rank: idx + 1,
    }));
  }
}
