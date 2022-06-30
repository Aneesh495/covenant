import { DocumentIR } from "./types";
import { GroundedCitation, CovenantError, EvidenceVerificationError } from "@covenant/shared";
import { findSourceMapEntriesInRange } from "./sourcemap";
import crypto from "crypto";

export interface CitationVerificationResult {
  valid: boolean;
  resolvedCitation?: GroundedCitation;
  reason?: string;
}

export function verifyCitationAgainstDocument(
  doc: DocumentIR,
  citation: GroundedCitation
): CitationVerificationResult {
  if (citation.startOffset < 0 || citation.endOffset > doc.canonicalText.length || citation.startOffset >= citation.endOffset) {
    return {
      valid: false,
      reason: `Citation offsets [${citation.startOffset}, ${citation.endOffset}) out of document bounds [0, ${doc.canonicalText.length})`,
    };
  }

  const actualSlice = doc.canonicalText.slice(citation.startOffset, citation.endOffset);
  if (actualSlice !== citation.exactQuote) {
    return {
      valid: false,
      reason: `Quoted text does not match canonical document slice. Expected "${citation.exactQuote}", found "${actualSlice}"`,
    };
  }

  const entries = findSourceMapEntriesInRange(doc.sourceMap, citation.startOffset, citation.endOffset);
  if (entries.length === 0) {
    return {
      valid: false,
      reason: `No source block found intersecting citation span`,
    };
  }

  // Ensure proposed blockId matches or intersects one of the entries
  const matchingEntry = entries.find((e) => e.blockId === citation.blockId) || entries[0];

  return {
    valid: true,
    resolvedCitation: {
      ...citation,
      blockId: matchingEntry.blockId,
      pageNumber: matchingEntry.pageNumber,
      boundingBox: matchingEntry.boundingBox,
      sourceType: matchingEntry.isOcr ? "ocr" : "digital_text",
      confidence: Math.min(citation.confidence, matchingEntry.confidence),
    },
  };
}

export function resolveProposedEvidence(
  doc: DocumentIR,
  proposed: {
    blockId?: string;
    exactQuote: string;
    contextHint?: string;
  }
): GroundedCitation {
  const quote = proposed.exactQuote.trim();
  if (!quote) {
    throw new EvidenceVerificationError("Proposed quote cannot be empty");
  }

  const canonical = doc.canonicalText;

  // Search inside proposed block first if blockId provided
  if (proposed.blockId) {
    const blockEntry = doc.sourceMap.find((e) => e.blockId === proposed.blockId);
    if (blockEntry) {
      const blockText = canonical.slice(blockEntry.canonicalStart, blockEntry.canonicalEnd);
      const indexInBlock = blockText.indexOf(quote);
      if (indexInBlock !== -1) {
        const startOffset = blockEntry.canonicalStart + indexInBlock;
        const endOffset = startOffset + quote.length;
        return {
          id: crypto.randomUUID(),
          blockId: blockEntry.blockId,
          pageNumber: blockEntry.pageNumber,
          startOffset,
          endOffset,
          exactQuote: quote,
          confidence: blockEntry.confidence,
          sourceType: blockEntry.isOcr ? "ocr" : "digital_text",
          boundingBox: blockEntry.boundingBox,
        };
      }
    }
  }

  // Search entire document
  let matchIndex = canonical.indexOf(quote);
  if (matchIndex === -1) {
    throw new EvidenceVerificationError(`Proposed quote not found in document: "${quote.slice(0, 80)}"`);
  }

  const allOccurrences: number[] = [];
  while (matchIndex !== -1) {
    allOccurrences.push(matchIndex);
    matchIndex = canonical.indexOf(quote, matchIndex + 1);
  }

  let selectedStart = allOccurrences[0];

  if (allOccurrences.length > 1) {
    if (proposed.contextHint) {
      // Disambiguate using context hint
      const hint = proposed.contextHint.trim();
      let bestScore = -1;
      let bestIndex = -1;

      for (const occ of allOccurrences) {
        const windowStart = Math.max(0, occ - 100);
        const windowEnd = Math.min(canonical.length, occ + quote.length + 100);
        const windowText = canonical.slice(windowStart, windowEnd);

        let score = 0;
        const hintWords = hint.split(/\s+/).filter((w) => w.length > 3);
        for (const word of hintWords) {
          if (windowText.includes(word)) score++;
        }

        if (score > bestScore) {
          bestScore = score;
          bestIndex = occ;
        }
      }

      if (bestIndex !== -1 && bestScore > 0) {
        selectedStart = bestIndex;
      } else {
        throw new EvidenceVerificationError(
          `Ambiguous quote matched ${allOccurrences.length} locations without distinguishing context: "${quote.slice(0, 50)}..."`
        );
      }
    } else {
      throw new EvidenceVerificationError(
        `Ambiguous quote matched ${allOccurrences.length} locations. Disambiguation context required.`
      );
    }
  }

  const selectedEnd = selectedStart + quote.length;
  const entries = findSourceMapEntriesInRange(doc.sourceMap, selectedStart, selectedEnd);
  if (entries.length === 0) {
    throw new EvidenceVerificationError("Matched span does not intersect any document block");
  }

  const entry = entries[0];
  return {
    id: crypto.randomUUID(),
    blockId: entry.blockId,
    pageNumber: entry.pageNumber,
    startOffset: selectedStart,
    endOffset: selectedEnd,
    exactQuote: quote,
    confidence: entry.confidence,
    sourceType: entry.isOcr ? "ocr" : "digital_text",
    boundingBox: entry.boundingBox,
  };
}
