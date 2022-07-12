import { DocumentIR } from "@covenant/document-ir";
import {
  ContractClauseNode,
  ClauseAlignmentPair,
  ContractComparisonResult,
  TokenDiffEntry,
  AlignmentType,
} from "./types";
import { ClauseSegmenter } from "./clause_segmenter";
import { EntityExtractor } from "./entity_extractor";
import { ObligationExtractor } from "./obligation_extractor";

export class VersionComparator {
  private segmenter = new ClauseSegmenter();
  private entityExtractor = new EntityExtractor();
  private obligationExtractor = new ObligationExtractor();

  compareContracts(baseDoc: DocumentIR, targetDoc: DocumentIR): ContractComparisonResult {
    const baseClauses = this.segmenter.segmentDocument(baseDoc);
    const targetClauses = this.segmenter.segmentDocument(targetDoc);

    const baseObligations = this.obligationExtractor.extractObligations(baseDoc, baseClauses);
    const targetObligations = this.obligationExtractor.extractObligations(targetDoc, targetClauses);

    const alignments: ClauseAlignmentPair[] = [];
    const matchedBaseIndices = new Set<number>();
    const matchedTargetIndices = new Set<number>();

    // Pass 1: Exact clause number + heading match
    for (let t = 0; t < targetClauses.length; t++) {
      const tc = targetClauses[t];
      for (let b = 0; b < baseClauses.length; b++) {
        if (matchedBaseIndices.has(b)) continue;
        const bc = baseClauses[b];

        if (
          bc.clauseNumber.length > 0 &&
          bc.clauseNumber === tc.clauseNumber &&
          (bc.heading.toLowerCase() === tc.heading.toLowerCase() || this.computeDiceSimilarity(bc.heading, tc.heading) > 0.6)
        ) {
          matchedBaseIndices.add(b);
          matchedTargetIndices.add(t);
          alignments.push(this.buildAlignmentPair(bc, tc, baseDoc, targetDoc));
          break;
        }
      }
    }

    // Pass 2: High content similarity (moved or renumbered clauses)
    for (let t = 0; t < targetClauses.length; t++) {
      if (matchedTargetIndices.has(t)) continue;
      const tc = targetClauses[t];

      let bestScore = 0;
      let bestBaseIdx = -1;

      for (let b = 0; b < baseClauses.length; b++) {
        if (matchedBaseIndices.has(b)) continue;
        const bc = baseClauses[b];
        const score = this.computeDiceSimilarity(bc.fullText, tc.fullText);

        if (score > bestScore && score >= 0.45) {
          bestScore = score;
          bestBaseIdx = b;
        }
      }

      if (bestBaseIdx !== -1) {
        matchedBaseIndices.add(bestBaseIdx);
        matchedTargetIndices.add(t);
        const pair = this.buildAlignmentPair(baseClauses[bestBaseIdx], tc, baseDoc, targetDoc);
        if (baseClauses[bestBaseIdx].clauseNumber !== tc.clauseNumber && pair.similarityScore > 0.7) {
          pair.alignmentType = "moved";
        }
        alignments.push(pair);
      }
    }

    // Pass 3: Unmatched target clauses -> Added
    for (let t = 0; t < targetClauses.length; t++) {
      if (!matchedTargetIndices.has(t)) {
        const tc = targetClauses[t];
        const tokenDiffs: TokenDiffEntry[] = this.tokenizeText(tc.fullText).map((token) => ({
          op: "insert",
          token,
        }));

        alignments.push({
          targetClause: tc,
          alignmentType: "added",
          similarityScore: 0.0,
          tokenDiffs,
          numericChanges: [],
          obligationChanges: [{ description: `New clause added: ${tc.heading}`, type: "added" }],
        });
      }
    }

    // Pass 4: Unmatched base clauses -> Deleted
    for (let b = 0; b < baseClauses.length; b++) {
      if (!matchedBaseIndices.has(b)) {
        const bc = baseClauses[b];
        const tokenDiffs: TokenDiffEntry[] = this.tokenizeText(bc.fullText).map((token) => ({
          op: "delete",
          token,
        }));

        alignments.push({
          baseClause: bc,
          alignmentType: "deleted",
          similarityScore: 0.0,
          tokenDiffs,
          numericChanges: [],
          obligationChanges: [{ description: `Clause removed: ${bc.heading}`, type: "removed" }],
        });
      }
    }

    // Compute summary metrics
    let identicalCount = 0;
    let modifiedCount = 0;
    let addedCount = 0;
    let deletedCount = 0;
    let movedCount = 0;
    let highRiskChangesCount = 0;

    for (const a of alignments) {
      if (a.alignmentType === "identical") identicalCount++;
      else if (a.alignmentType === "modified") modifiedCount++;
      else if (a.alignmentType === "added") addedCount++;
      else if (a.alignmentType === "deleted") deletedCount++;
      else if (a.alignmentType === "moved") movedCount++;

      if (a.numericChanges.length > 0 || a.obligationChanges.length > 0) {
        highRiskChangesCount++;
      }
    }

    return {
      baseDocumentId: baseDoc.id,
      targetDocumentId: targetDoc.id,
      baseVersionSha256: baseDoc.originalSha256,
      targetVersionSha256: targetDoc.originalSha256,
      alignments,
      summary: {
        totalClausesBase: baseClauses.length,
        totalClausesTarget: targetClauses.length,
        identicalCount,
        modifiedCount,
        addedCount,
        deletedCount,
        movedCount,
        highRiskChangesCount,
      },
    };
  }

  private buildAlignmentPair(
    baseClause: ContractClauseNode,
    targetClause: ContractClauseNode,
    baseDoc: DocumentIR,
    targetDoc: DocumentIR
  ): ClauseAlignmentPair {
    const isExact = baseClause.fullText.trim() === targetClause.fullText.trim();
    const similarity = isExact ? 1.0 : this.computeDiceSimilarity(baseClause.fullText, targetClause.fullText);

    const alignmentType: AlignmentType = isExact
      ? "identical"
      : baseClause.clauseNumber !== targetClause.clauseNumber && similarity > 0.85
      ? "moved"
      : "modified";

    const tokenDiffs = isExact
      ? this.tokenizeText(baseClause.fullText).map((t) => ({ op: "equal" as const, token: t }))
      : this.computeTokenDiff(baseClause.fullText, targetClause.fullText);

    // Analyze numeric changes (notice periods, caps, durations)
    const baseNumerics = this.entityExtractor.extractNumericQuantities(baseClause.fullText, baseClause.canonicalStart);
    const targetNumerics = this.entityExtractor.extractNumericQuantities(targetClause.fullText, targetClause.canonicalStart);
    const numericChanges: ClauseAlignmentPair["numericChanges"] = [];

    const allKeys = new Set([...Object.keys(baseNumerics), ...Object.keys(targetNumerics)]);
    for (const key of Array.from(allKeys)) {
      const bVal = baseNumerics[key];
      const tVal = targetNumerics[key];

      if (bVal && tVal && bVal.value !== tVal.value) {
        numericChanges.push({
          field: key,
          oldValue: bVal.value,
          newValue: tVal.value,
          unit: tVal.unit,
          description: `${key} changed from ${bVal.rawText} to ${tVal.rawText}`,
        });
      } else if (bVal && !tVal) {
        numericChanges.push({
          field: key,
          oldValue: bVal.value,
          unit: bVal.unit,
          description: `${key} (${bVal.rawText}) was removed`,
        });
      } else if (!bVal && tVal) {
        numericChanges.push({
          field: key,
          newValue: tVal.value,
          unit: tVal.unit,
          description: `${key} was added with value ${tVal.rawText}`,
        });
      }
    }

    // Analyze obligation changes
    const obligationChanges: ClauseAlignmentPair["obligationChanges"] = [];
    const baseHasMust = /\b(shall|must)\b/i.test(baseClause.fullText);
    const targetHasMay = /\b(may)\b/i.test(targetClause.fullText);
    const targetHasMustNot = /\b(shall not|must not)\b/i.test(targetClause.fullText);

    if (baseHasMust && targetHasMay && !/\b(shall|must)\b/i.test(targetClause.fullText)) {
      obligationChanges.push({
        type: "modality_shift",
        description: "Mandatory obligation ('shall/must') relaxed to discretionary ('may')",
      });
    }
    if (!baseHasMust && targetHasMustNot) {
      obligationChanges.push({
        type: "added",
        description: "New negative covenant ('shall not/must not') introduced",
      });
    }

    return {
      baseClause,
      targetClause,
      alignmentType,
      similarityScore: similarity,
      tokenDiffs,
      numericChanges,
      obligationChanges,
    };
  }

  tokenizeText(text: string): string[] {
    return text.match(/\S+|\s+/g) || [];
  }

  computeTokenDiff(baseText: string, targetText: string): TokenDiffEntry[] {
    const a = this.tokenizeText(baseText);
    const b = this.tokenizeText(targetText);

    // Compute Longest Common Subsequence matrix
    const m = a.length;
    const n = b.length;

    // Use bounded matrix to avoid allocation explosion on huge clauses
    if (m * n > 250000) {
      // Fast fallback for very large chunks
      return [
        ...a.map((t) => ({ op: "delete" as const, token: t })),
        ...b.map((t) => ({ op: "insert" as const, token: t })),
      ];
    }

    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        if (a[i] === b[j]) {
          dp[i + 1][j + 1] = dp[i][j] + 1;
        } else {
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    // Backtrack to build diff entries
    const diffs: TokenDiffEntry[] = [];
    let i = m;
    let j = n;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        diffs.push({ op: "equal", token: a[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        diffs.push({ op: "insert", token: b[j - 1] });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        diffs.push({ op: "delete", token: a[i - 1] });
        i--;
      }
    }

    return diffs.reverse();
  }

  computeDiceSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().match(/[a-z0-9]+/g) || [];
    const words2 = str2.toLowerCase().match(/[a-z0-9]+/g) || [];

    if (words1.length === 0 && words2.length === 0) return 1.0;
    if (words1.length === 0 || words2.length === 0) return 0.0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    let intersection = 0;
    for (const w of Array.from(set1)) {
      if (set2.has(w)) intersection++;
    }

    return (2.0 * intersection) / (set1.size + set2.size);
  }
}
