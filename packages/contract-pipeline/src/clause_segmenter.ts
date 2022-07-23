import { DocumentIR, BlockNode } from "@covenant/document-ir";
import { ContractClauseNode } from "./types";
import crypto from "crypto";

interface SectionPatternMatch {
  clauseNumber: string;
  heading: string;
  level: number;
}

export class ClauseSegmenter {
  private static SECTION_PATTERNS: Array<{ regex: RegExp; levelOffset: number }> = [
    // ARTICLE I or Article 1
    { regex: /^(?:ARTICLE|Article)\s+([0-9IVXLCDM]+)[:.]?\s*(.*)$/, levelOffset: 1 },
    // SECTION 1.1 or Section 1
    { regex: /^(?:SECTION|Section)\s+([0-9]+(?:\.[0-9]+)*)[:.]?\s*(.*)$/, levelOffset: 1 },
    // 1.1.1 or 1.1 or 1.
    { regex: /^([0-9]+(?:\.[0-9]+)+)[:.]?\s+(.*)$/, levelOffset: 0 },
    { regex: /^([0-9]+)\.\s+(.*)$/, levelOffset: 1 },
    // (a) or (i) - subsection
    { regex: /^\(([a-z0-9]+)\)\s+(.*)$/i, levelOffset: 3 },
    // EXHIBIT A or SCHEDULE 1
    { regex: /^(?:EXHIBIT|SCHEDULE|ANNEX|APPENDIX)\s+([A-Z0-9]+)[:.]?\s*(.*)$/i, levelOffset: 1 },
  ];

  segmentDocument(doc: DocumentIR): ContractClauseNode[] {
    const clauses: ContractClauseNode[] = [];
    let currentClause: ContractClauseNode | null = null;
    const hierarchyStack: ContractClauseNode[] = [];

    for (const page of doc.pages) {
      for (const block of page.blocks) {
        const match = this.detectSectionHeader(block);

        if (match) {
          // Finalize current clause
          if (currentClause) {
            this.finalizeClause(currentClause, doc);
            clauses.push(currentClause);
          }

          // Determine parent from hierarchy stack
          while (
            hierarchyStack.length > 0 &&
            hierarchyStack[hierarchyStack.length - 1].level >= match.level
          ) {
            hierarchyStack.pop();
          }

          const parent = hierarchyStack.length > 0 ? hierarchyStack[hierarchyStack.length - 1] : undefined;

          currentClause = {
            id: `cl-${crypto.randomUUID()}`,
            clauseNumber: match.clauseNumber,
            heading: match.heading || block.text.trim(),
            level: match.level,
            parentId: parent?.id,
            childClauseIds: [],
            blockIds: [block.id],
            pageNumber: page.pageNumber,
            canonicalStart: block.canonicalStart,
            canonicalEnd: block.canonicalEnd,
            bodyText: "",
            fullText: block.text,
            category: this.categorizeHeading(match.heading || block.text),
          };

          if (parent) {
            parent.childClauseIds.push(currentClause.id);
          }

          hierarchyStack.push(currentClause);
        } else {
          // Paragraph or table block continuing previous clause or preamble
          if (!currentClause) {
            // Preamble before first section
            currentClause = {
              id: `cl-${crypto.randomUUID()}`,
              clauseNumber: "",
              heading: "Preamble",
              level: 0,
              childClauseIds: [],
              blockIds: [block.id],
              pageNumber: page.pageNumber,
              canonicalStart: block.canonicalStart,
              canonicalEnd: block.canonicalEnd,
              bodyText: block.text,
              fullText: block.text,
              category: "preamble",
            };
            hierarchyStack.push(currentClause);
          } else {
            currentClause.blockIds.push(block.id);
            currentClause.canonicalEnd = block.canonicalEnd;
            if (currentClause.bodyText.length > 0) {
              currentClause.bodyText += "\n\n" + block.text;
            } else {
              currentClause.bodyText = block.text;
            }
            currentClause.fullText += "\n\n" + block.text;
          }
        }
      }
    }

    if (currentClause) {
      this.finalizeClause(currentClause, doc);
      clauses.push(currentClause);
    }

    return clauses;
  }

  private detectSectionHeader(block: BlockNode): SectionPatternMatch | null {
    const trimmed = block.text.trim();

    // Check if designated as heading by ingestion
    if (block.type === "heading") {
      for (const pattern of ClauseSegmenter.SECTION_PATTERNS) {
        const m = trimmed.match(pattern.regex);
        if (m) {
          const num = m[1];
          const rest = m[2] ? m[2].trim() : "";
          const dotCount = (num.match(/\./g) || []).length;
          const level = pattern.levelOffset > 0 ? pattern.levelOffset + dotCount : dotCount + 1;
          return { clauseNumber: num, heading: rest || trimmed, level };
        }
      }

      // Heading block without explicit section number
      return { clauseNumber: "", heading: trimmed, level: 1 };
    }

    // Check regular paragraph start for section headers
    for (const pattern of ClauseSegmenter.SECTION_PATTERNS) {
      const m = trimmed.match(pattern.regex);
      if (m) {
        const num = m[1];
        const rest = m[2] ? m[2].trim() : "";
        const dotCount = (num.match(/\./g) || []).length;
        const level = pattern.levelOffset > 0 ? pattern.levelOffset + dotCount : dotCount + 1;
        return { clauseNumber: num, heading: rest || trimmed, level };
      }
    }

    return null;
  }

  private finalizeClause(clause: ContractClauseNode, doc: DocumentIR): void {
    if (clause.category === "preamble") return;
    let cat = this.categorizeHeading(clause.heading);
    if (!cat || cat === "unknown") {
      cat = this.categorizeBody(clause.bodyText || clause.fullText);
    }
    clause.category = cat || "unknown";
  }

  categorizeHeading(heading: string): string {
    const lower = heading.toLowerCase();

    if (
      lower.includes("confidential") ||
      lower.includes("non-disclosure") ||
      lower.includes("proprietary information") ||
      lower.includes("obligations of recipient") ||
      lower.includes("recipient obligations") ||
      lower.includes("secrecy")
    ) {
      return "confidentiality";
    }
    if (lower.includes("at-will") || lower.includes("at will")) {
      return "at_will";
    }
    if (lower.includes("intellectual property") || lower.includes("inventions") || lower.includes("work for hire") || lower.includes("ip ownership")) {
      return "intellectual_property";
    }
    if (lower.includes("indemnif") || lower.includes("hold harmless")) {
      return "indemnification";
    }
    if (lower.includes("limitation of liability") || lower.includes("liability limitation") || lower.includes("consequential damages") || lower.includes("liability")) {
      return "liability_limitation";
    }
    if (lower.includes("termination") || lower.includes("term and termination")) {
      return "termination";
    }
    if (lower.includes("term of confidentiality") || lower.startsWith("term")) {
      return "term";
    }
    if (lower.includes("governing law") || lower.includes("jurisdiction") || lower.includes("choice of law") || lower.includes("dispute")) {
      return "governing_law";
    }
    if (lower.includes("non-compete") || lower.includes("non-competition") || lower.includes("competitive activities")) {
      return "restrictive_covenants";
    }
    if (lower.includes("non-solicit") || lower.includes("non-solicitation")) {
      return "non_solicitation";
    }
    if (lower.includes("payment") || lower.includes("fees") || lower.includes("compensation") || lower.includes("invoicing")) {
      return "payment";
    }
    if (lower.includes("warrant") || lower.includes("representation")) {
      return "warranties";
    }
    if (lower.includes("notice")) {
      return "notices";
    }
    if (lower.includes("severab")) {
      return "severability";
    }
    if (lower.includes("entire agreement") || lower.includes("integration") || lower.includes("amendment")) {
      return "entire_agreement";
    }
    if (lower.includes("remed") || lower.includes("injunctive relief")) {
      return "remedies";
    }
    if (lower.includes("assignment") || lower.includes("subcontracting")) {
      return "assignment";
    }
    if (lower.includes("audit") || lower.includes("records")) {
      return "audit_rights";
    }

    return "unknown";
  }

  private categorizeBody(bodyText: string): string {
    const lower = bodyText.toLowerCase();
    if (lower.includes("at-will") || lower.includes("at will") || lower.includes("with or without cause")) {
      return "at_will";
    }
    if (
      lower.includes("shall keep confidential") ||
      lower.includes("confidential information") ||
      lower.includes("strict confidence") ||
      lower.includes("shall not disclose") ||
      lower.includes("proprietary information")
    ) {
      return "confidentiality";
    }
    if (lower.includes("indemnify, defend and hold harmless") || lower.includes("indemnif")) {
      return "indemnification";
    }
    if (lower.includes("in no event shall either party be liable") || lower.includes("aggregate liability") || lower.includes("limitation of liability")) {
      return "liability_limitation";
    }
    if (lower.includes("non-compete") || lower.includes("competing financial enterprise") || lower.includes("engage in any competing")) {
      return "restrictive_covenants";
    }
    if (lower.includes("assigns all inventions") || lower.includes("prior inventions") || lower.includes("proprietary information and inventions")) {
      return "intellectual_property";
    }
    if (lower.includes("invoice") || lower.includes("net 30") || lower.includes("payment")) {
      return "payment";
    }
    if (lower.includes("either party may terminate") || lower.includes("termination")) {
      return "termination";
    }
    if (lower.includes("governed by the laws of")) {
      return "governing_law";
    }
    return "general_clause";
  }
}
