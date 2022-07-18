import { DocumentIR } from "@covenant/document-ir";
import { EvidenceVerificationResult, ProposedFinding } from "./types";
import { GroundedFinding, GroundedCitation } from "@covenant/shared";
import crypto from "crypto";

export class EvidenceVerifier {
  verifyQuote(proposedQuote: string, doc: DocumentIR): EvidenceVerificationResult {
    const quote = proposedQuote.trim();
    if (quote.length === 0) {
      return {
        isGrounded: false,
        exactQuote: "",
        confidence: 0,
        rejectionReason: "Proposed quote is empty.",
      };
    }

    // 1. Direct exact substring match in canonical text
    const exactIndex = doc.canonicalText.indexOf(quote);
    if (exactIndex !== -1) {
      const endOffset = exactIndex + quote.length;
      return {
        isGrounded: true,
        startOffset: exactIndex,
        endOffset,
        exactQuote: quote,
        confidence: 1.0,
      };
    }

    // 2. Normalized whitespace match
    const normalizedQuote = this.normalizeWhitespace(quote);
    const normalizedDoc = this.normalizeWhitespace(doc.canonicalText);
    const normIndex = normalizedDoc.indexOf(normalizedQuote);

    if (normIndex !== -1) {
      // Find corresponding actual indices in canonical text
      const actualSpan = this.findOriginalSpan(doc.canonicalText, quote);
      if (actualSpan) {
        return {
          isGrounded: true,
          startOffset: actualSpan.start,
          endOffset: actualSpan.end,
          exactQuote: doc.canonicalText.slice(actualSpan.start, actualSpan.end),
          confidence: 0.95,
        };
      }
    }

    // 3. Fallback: Check if first 30 characters and last 30 characters exist in proximity
    if (quote.length > 60) {
      const prefix = quote.slice(0, 30);
      const suffix = quote.slice(-30);
      const prefixIdx = doc.canonicalText.indexOf(prefix);
      if (prefixIdx !== -1) {
        const suffixIdx = doc.canonicalText.indexOf(suffix, prefixIdx);
        if (suffixIdx !== -1 && suffixIdx - prefixIdx < quote.length * 1.5) {
          const end = suffixIdx + suffix.length;
          return {
            isGrounded: true,
            startOffset: prefixIdx,
            endOffset: end,
            exactQuote: doc.canonicalText.slice(prefixIdx, end),
            confidence: 0.85,
          };
        }
      }
    }

    // Quote does not exist in document - reject hallucination
    return {
      isGrounded: false,
      exactQuote: quote,
      confidence: 0,
      rejectionReason: "Proposed quote was not found in document canonical text.",
    };
  }

  groundProposedFinding(
    proposed: ProposedFinding,
    doc: DocumentIR,
    workflow: "contract_review" | "resume_intelligence"
  ): GroundedFinding | null {
    const citations: GroundedCitation[] = [];

    if (proposed.proposedQuote) {
      const verification = this.verifyQuote(proposed.proposedQuote, doc);

      if (!verification.isGrounded) {
        // Reject ungrounded finding to prevent hallucinated citations
        return null;
      }

      const start = verification.startOffset ?? 0;
      const end = verification.endOffset ?? start + verification.exactQuote.length;

      // Locate block in source map
      const block = doc.sourceMap.find((s) => s.canonicalStart <= start && s.canonicalEnd >= end) || doc.sourceMap[0];

      citations.push({
        id: `cit-${crypto.randomUUID()}`,
        blockId: block?.blockId || "b-verified",
        pageNumber: block?.pageNumber || 1,
        startOffset: start,
        endOffset: end,
        exactQuote: verification.exactQuote,
        confidence: verification.confidence,
        sourceType: block?.isOcr ? "ocr" : "digital_text",
        boundingBox: block?.boundingBox,
      });
    }

    return {
      id: `find-${crypto.randomUUID()}`,
      workflow,
      category: proposed.category,
      severity: proposed.severity,
      title: proposed.title,
      explanation: proposed.explanation,
      suggestedAction: proposed.suggestedAction,
      citations,
      confidence: citations.length > 0 ? "high" : "medium",
      decisionState: "pending",
    };
  }

  private normalizeWhitespace(str: string): string {
    return str.replace(/\s+/g, " ").trim().toLowerCase();
  }

  private findOriginalSpan(canonical: string, targetQuote: string): { start: number; end: number } | null {
    const cleanTarget = targetQuote.replace(/[^\w\s]/g, "").toLowerCase();
    const words = cleanTarget.split(/\s+/).filter((w) => w.length > 2);
    if (words.length < 2) return null;

    const firstWord = words[0];
    const lastWord = words[words.length - 1];

    let searchIdx = 0;
    while (searchIdx < canonical.length) {
      const fIdx = canonical.toLowerCase().indexOf(firstWord, searchIdx);
      if (fIdx === -1) break;

      const lIdx = canonical.toLowerCase().indexOf(lastWord, fIdx);
      if (lIdx !== -1 && lIdx - fIdx < targetQuote.length * 2) {
        return {
          start: fIdx,
          end: lIdx + lastWord.length,
        };
      }
      searchIdx = fIdx + 1;
    }

    return null;
  }
}
