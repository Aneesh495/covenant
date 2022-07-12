import { DocumentIR } from "@covenant/document-ir";
import {
  ExtractedParty,
  DefinedTerm,
  ContractClauseNode,
} from "./types";
import crypto from "crypto";

export interface ExtractedNumericQuantity {
  value: number;
  unit: string;
  rawText: string;
  startOffset: number;
  endOffset: number;
}

export class EntityExtractor {
  extractParties(doc: DocumentIR, clauses: ContractClauseNode[]): ExtractedParty[] {
    const parties: ExtractedParty[] = [];
    const preambleClause = clauses.find((c) => c.category === "preamble") || clauses[0];
    const searchText = preambleClause ? preambleClause.fullText : doc.canonicalText.slice(0, 3000);
    const baseOffset = preambleClause ? preambleClause.canonicalStart : 0;
    const blockId = preambleClause?.blockIds[0] || doc.pages[0]?.blocks[0]?.id || "b-preamble";

    // Pattern 1: Between [Party A] ("Alias A") and [Party B] ("Alias B")
    const partyRegex = /(?:between|by and between|and)\s+([A-Z][A-Za-z0-9\s,\.\-&]+?)\s*(?:\([^\)]*?(?:the\s+)?["“]([A-Za-z\s]+)["”]\)|,\s*(?:a|an)\s+[A-Za-z\s]+(?:corporation|company|LLC|limited|individual)[^\(]*?\((?:the\s+)?["“]([A-Za-z\s]+)["”]\))/gi;

    let match: RegExpExecArray | null;
    while ((match = partyRegex.exec(searchText)) !== null) {
      const rawName = match[1].trim().replace(/^,\s*/, "").replace(/\s*,$/, "");
      const shortAlias = (match[2] || match[3] || "").trim();

      if (rawName.length > 2 && rawName.length < 100 && !rawName.toLowerCase().startsWith("the laws")) {
        const start = baseOffset + match.index;
        const end = start + match[0].length;
        parties.push({
          id: `party-${crypto.randomUUID()}`,
          name: rawName,
          shortName: shortAlias || rawName,
          role: this.inferPartyRole(shortAlias || rawName),
          canonicalStart: start,
          canonicalEnd: end,
          blockId,
        });
      }
    }

    // Fallback: If regex did not catch both parties, check common company suffixes
    if (parties.length === 0) {
      const fallbackRegex = /([A-Z][A-Za-z0-9\s,\.\-&]+?(?:Inc\.|LLC|Ltd\.|Corporation|Corp\.|Company))/g;
      while ((match = fallbackRegex.exec(searchText)) !== null) {
        const name = match[1].trim();
        const start = baseOffset + match.index;
        parties.push({
          id: `party-${crypto.randomUUID()}`,
          name,
          shortName: name,
          role: "contracting_party",
          canonicalStart: start,
          canonicalEnd: start + name.length,
          blockId,
        });
        if (parties.length >= 2) break;
      }
    }

    return parties;
  }

  extractDefinedTerms(doc: DocumentIR, clauses: ContractClauseNode[]): DefinedTerm[] {
    const definedTerms: DefinedTerm[] = [];

    // Find definitions section or search all clauses
    const defClauses = clauses.filter((c) =>
      c.heading.toLowerCase().includes("definition") ||
      c.category === "confidentiality" ||
      c.level <= 2
    );

    const targetClauses = defClauses.length > 0 ? defClauses : clauses;

    const defPatterns = [
      /["“]([A-Z][A-Za-z0-9\s\-_]+)["”]\s+(?:shall\s+mean|means|has\s+the\s+meaning|refers\s+to)\s+([^;\.]+[;\.])/g,
      /\(([A-Z][A-Za-z0-9\s\-_]+)\)\s+(?:shall\s+mean|means)\s+([^;\.]+[;\.])/g,
    ];

    for (const clause of targetClauses) {
      for (const pattern of defPatterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(clause.fullText)) !== null) {
          const term = match[1].trim();
          const definition = match[2].trim();
          const start = clause.canonicalStart + match.index;
          const end = start + match[0].length;

          if (term.length > 1 && term.length < 60) {
            definedTerms.push({
              term,
              definition,
              canonicalStart: start,
              canonicalEnd: end,
              blockId: clause.blockIds[0] || "block-def",
            });
          }
        }
      }
    }

    return definedTerms;
  }

  extractNumericQuantities(text: string, baseOffset: number): Record<string, ExtractedNumericQuantity> {
    const quantities: Record<string, ExtractedNumericQuantity> = {};

    // 1. Durations and notice periods (e.g. "30 days", "thirty (30) days", "60 calendar days", "12 months")
    const durationRegex = /(?:[a-zA-Z]+\s+)?\(?(\d+)\)?\s*(calendar\s+|business\s+)?(days?|months?|years?|weeks?)/gi;
    let match: RegExpExecArray | null;

    while ((match = durationRegex.exec(text)) !== null) {
      const num = parseInt(match[1], 10);
      const rawUnit = match[3].toLowerCase();
      let normalizedUnit = "days";
      let daysValue = num;

      if (rawUnit.startsWith("month")) {
        normalizedUnit = "months";
        daysValue = num * 30;
      } else if (rawUnit.startsWith("year")) {
        normalizedUnit = "years";
        daysValue = num * 365;
      }

      const lowerWindow = text.slice(Math.max(0, match.index - 40), match.index + match[0].length + 40).toLowerCase();

      if (lowerWindow.includes("notice") || lowerWindow.includes("terminate") || lowerWindow.includes("cure")) {
        quantities.notice_period_days = {
          value: daysValue,
          unit: "days",
          rawText: match[0],
          startOffset: baseOffset + match.index,
          endOffset: baseOffset + match.index + match[0].length,
        };
      } else if (lowerWindow.includes("non-compete") || lowerWindow.includes("restrictive")) {
        quantities.non_compete_months = {
          value: normalizedUnit === "months" ? num : Math.round(num / 30),
          unit: "months",
          rawText: match[0],
          startOffset: baseOffset + match.index,
          endOffset: baseOffset + match.index + match[0].length,
        };
      } else if (lowerWindow.includes("net") || lowerWindow.includes("payment") || lowerWindow.includes("invoice")) {
        quantities.payment_net_days = {
          value: daysValue,
          unit: "days",
          rawText: match[0],
          startOffset: baseOffset + match.index,
          endOffset: baseOffset + match.index + match[0].length,
        };
      }
    }

    // 2. Monetary amounts ($1,000,000 or USD 50,000)
    const moneyRegex = /(?:\$|USD\s*|EUR\s*|GBP\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(million|billion|thousand)?/gi;
    while ((match = moneyRegex.exec(text)) !== null) {
      let rawVal = parseFloat(match[1].replace(/,/g, ""));
      const multiplier = (match[2] || "").toLowerCase();
      if (multiplier === "million") rawVal *= 1000000;
      if (multiplier === "billion") rawVal *= 1000000000;
      if (multiplier === "thousand") rawVal *= 1000;

      const lowerContext = text.slice(Math.max(0, match.index - 50), match.index + match[0].length + 50).toLowerCase();

      if (lowerContext.includes("liability") || lowerContext.includes("aggregate") || lowerContext.includes("cap")) {
        quantities.liability_cap_usd = {
          value: rawVal,
          unit: "usd",
          rawText: match[0],
          startOffset: baseOffset + match.index,
          endOffset: baseOffset + match.index + match[0].length,
        };
      } else {
        quantities.amount_usd = {
          value: rawVal,
          unit: "usd",
          rawText: match[0],
          startOffset: baseOffset + match.index,
          endOffset: baseOffset + match.index + match[0].length,
        };
      }
    }

    return quantities;
  }

  extractGoverningLaw(doc: DocumentIR, clauses: ContractClauseNode[]): { jurisdiction: string; canonicalStart: number; canonicalEnd: number } | undefined {
    const govClause = clauses.find((c) => c.category === "governing_law");
    const searchText = govClause ? govClause.fullText : doc.canonicalText;
    const baseOffset = govClause ? govClause.canonicalStart : 0;

    const regex = /(?:governed by|construed in accordance with)\s+(?:and\s+under\s+)?(?:the\s+laws\s+of\s+)?(?:the\s+State\s+of\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/;
    const match = searchText.match(regex);
    if (match && match.index !== undefined) {
      const jurisdiction = match[1].trim();
      return {
        jurisdiction,
        canonicalStart: baseOffset + match.index,
        canonicalEnd: baseOffset + match.index + match[0].length,
      };
    }
    return undefined;
  }

  private inferPartyRole(nameOrAlias: string): string {
    const lower = nameOrAlias.toLowerCase();
    if (lower.includes("company") || lower.includes("employer") || lower.includes("client")) {
      return "primary_entity";
    }
    if (lower.includes("contractor") || lower.includes("consultant") || lower.includes("employee") || lower.includes("vendor")) {
      return "counterparty";
    }
    if (lower.includes("disclosing")) return "disclosing_party";
    if (lower.includes("receiving")) return "receiving_party";
    return "party";
  }
}
