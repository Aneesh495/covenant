import { DocumentIR } from "@covenant/document-ir";
import {
  ContractClauseNode,
  ExtractedObligation,
  ModalityType,
} from "./types";
import { ExtractedClauseEntity } from "@covenant/policies";
import { EntityExtractor } from "./entity_extractor";
import crypto from "crypto";

export class ObligationExtractor {
  private entityExtractor = new EntityExtractor();

  private static MODAL_PATTERNS: Array<{ regex: RegExp; modality: ModalityType }> = [
    { regex: /\bshall\s+not\b/i, modality: "shall_not" },
    { regex: /\bmust\s+not\b/i, modality: "must_not" },
    { regex: /\bshall\b/i, modality: "shall" },
    { regex: /\bmust\b/i, modality: "must" },
    { regex: /\bwill\b/i, modality: "will" },
    { regex: /\bmay\b/i, modality: "may" },
  ];

  extractObligations(doc: DocumentIR, clauses: ContractClauseNode[]): ExtractedObligation[] {
    const obligations: ExtractedObligation[] = [];

    for (const clause of clauses) {
      const sentences = this.splitIntoSentences(clause.bodyText || clause.fullText);
      let sentenceOffset = clause.canonicalStart;

      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length < 10) continue;

        const startInDoc = doc.canonicalText.indexOf(trimmed, sentenceOffset);
        const actualStart = startInDoc !== -1 ? startInDoc : sentenceOffset;
        const actualEnd = actualStart + trimmed.length;
        sentenceOffset = actualEnd;

        const modalMatch = this.detectModality(trimmed);
        if (modalMatch) {
          const { modality, index: modalIndex, length: modalLength } = modalMatch;
          const actorRaw = trimmed.slice(0, modalIndex).trim();
          const actionRaw = trimmed.slice(modalIndex + modalLength).trim();

          const actor = this.cleanActor(actorRaw);
          const isBilateral = this.isMutualActor(actor) || this.detectMutualLanguage(trimmed);
          const condition = this.extractCondition(trimmed);
          const exceptions = this.extractExceptions(trimmed);
          const numericValues = this.entityExtractor.extractNumericQuantities(trimmed, actualStart);

          obligations.push({
            id: `obl-${crypto.randomUUID()}`,
            clauseId: clause.id,
            actor,
            modality,
            action: actionRaw,
            condition,
            exceptions,
            isBilateral,
            numericValues,
            canonicalStart: actualStart,
            canonicalEnd: actualEnd,
            exactQuote: trimmed,
            blockId: clause.blockIds[0] || "b-unknown",
          });
        }
      }
    }

    return obligations;
  }

  toPolicyEntities(clauses: ContractClauseNode[], obligations: ExtractedObligation[]): ExtractedClauseEntity[] {
    const entities: ExtractedClauseEntity[] = [];

    // Group obligations by clause
    const obligationsByClause = new Map<string, ExtractedObligation[]>();
    for (const obl of obligations) {
      const list = obligationsByClause.get(obl.clauseId) || [];
      list.push(obl);
      obligationsByClause.set(obl.clauseId, list);
    }

    for (const clause of clauses) {
      const clauseObls = obligationsByClause.get(clause.id) || [];
      const primaryObl = clauseObls[0];

      // Extract referenced clauses e.g. "Section 4.2" or "Section 14"
      const referencedClauses = this.extractReferencedClauses(clause.fullText);

      // Collect numeric values across the clause and its obligations
      const clauseNumerics = this.entityExtractor.extractNumericQuantities(clause.fullText, clause.canonicalStart);
      for (const obl of clauseObls) {
        Object.assign(clauseNumerics, obl.numericValues);
      }

      // Collect all exceptions
      const allExceptions: string[] = [];
      for (const obl of clauseObls) {
        if (obl.exceptions) {
          allExceptions.push(...obl.exceptions);
        }
      }

      const isBilateral = clauseObls.length > 0
        ? clauseObls.every((o) => o.isBilateral)
        : this.detectMutualLanguage(clause.fullText);

      entities.push({
        id: clause.id,
        category: clause.category || "unknown",
        text: clause.fullText,
        canonicalStart: clause.canonicalStart,
        canonicalEnd: clause.canonicalEnd,
        blockId: clause.blockIds[0] || "b-unknown",
        pageNumber: clause.pageNumber,
        actor: primaryObl?.actor,
        action: primaryObl?.action,
        isBilateral,
        numericValues: clauseNumerics,
        exceptions: allExceptions.length > 0 ? allExceptions : undefined,
        referencedClauses: referencedClauses.length > 0 ? referencedClauses : undefined,
      });
    }

    return entities;
  }

  private detectModality(sentence: string): { modality: ModalityType; index: number; length: number } | null {
    for (const item of ObligationExtractor.MODAL_PATTERNS) {
      const match = sentence.match(item.regex);
      if (match && match.index !== undefined) {
        return {
          modality: item.modality,
          index: match.index,
          length: match[0].length,
        };
      }
    }
    return null;
  }

  private cleanActor(raw: string): string {
    const cleaned = raw
      .replace(/^(furthermore|additionally|provided that|subject to [^,]+,|in addition|however),?\s*/i, "")
      .replace(/^[0-9\.\(\)\s]+/, "")
      .trim();

    if (cleaned.length === 0) return "party";
    // Keep last subject clause if complex
    const lastComma = cleaned.lastIndexOf(",");
    return (lastComma !== -1 ? cleaned.slice(lastComma + 1) : cleaned).trim();
  }

  private isMutualActor(actor: string): boolean {
    const lower = actor.toLowerCase();
    return (
      lower.includes("either party") ||
      lower.includes("each party") ||
      lower.includes("both parties") ||
      lower.includes("the parties") ||
      lower.includes("neither party")
    );
  }

  private detectMutualLanguage(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      lower.includes("mutually") ||
      lower.includes("mutual") ||
      lower.includes("each party agrees") ||
      lower.includes("each party shall") ||
      lower.includes("either party may") ||
      (lower.includes("party a") && lower.includes("party b"))
    );
  }

  private extractCondition(text: string): string | undefined {
    const m = text.match(/(?:provided that|subject to|in the event that|if|unless)\s+([^,;\.]+)/i);
    return m ? m[0].trim() : undefined;
  }

  private extractExceptions(text: string): string[] {
    const exceptions: string[] = [];
    const m = text.match(/(?:except for|other than|excluding|with the exception of)\s+([^;\.]+)/i);
    if (m) {
      const phrase = m[1].trim();
      const parts = phrase.split(/(?:,\s*and\s*|,\s*or\s*|,\s*|\s+and\s+|\s+or\s+)/);
      for (const part of parts) {
        const cleaned = part.trim().toLowerCase();
        if (cleaned.length > 3) {
          exceptions.push(cleaned);
        }
      }
    }
    return exceptions;
  }

  private extractReferencedClauses(text: string): string[] {
    const refs: string[] = [];
    const regex = /(?:Section|Article|Clause)\s+([0-9]+(?:\.[0-9]+)*)/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      refs.push(match[1]);
    }
    return refs;
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .split(/(?<=[.?!])\s+(?=[A-Z0-9"“])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
}
