import { DocumentIR } from "@covenant/document-ir";
import {
  PolicyRule,
  ConditionNode,
  RuleExecutionTrace,
  NumericOperator,
} from "./ast";
import { GroundedFinding, GroundedCitation } from "@covenant/shared";
import crypto from "crypto";

export interface ExtractedClauseEntity {
  id: string;
  category: string;
  text: string;
  canonicalStart: number;
  canonicalEnd: number;
  blockId: string;
  pageNumber: number;
  actor?: string;
  action?: string;
  target?: string;
  isBilateral?: boolean;
  numericValues?: Record<string, { value: number; unit: string; rawText: string }>;
  exceptions?: string[];
  referencedClauses?: string[];
}

export interface ContractEvaluationContext {
  document: DocumentIR;
  clauses: ExtractedClauseEntity[];
  definedSections: Set<string>; // e.g. "1.1", "4.2", "Section 5"
  extractionConfidence: number; // 0.0 to 1.0 (if < 0.7, abstain from missing-clause findings)
}

export interface PolicyEvaluationResult {
  findings: GroundedFinding[];
  traces: RuleExecutionTrace[];
}

export class PolicyEvaluator {
  evaluatePlaybook(
    rules: PolicyRule[],
    context: ContractEvaluationContext
  ): PolicyEvaluationResult {
    const findings: GroundedFinding[] = [];
    const traces: RuleExecutionTrace[] = [];

    for (const rule of rules) {
      const trace = this.evaluateRule(rule, context);
      traces.push(trace);

      if (!trace.passed) {
        // Construct grounded finding from failed condition
        const ruleCitations: GroundedCitation[] = trace.citations.map((c) => {
          const block = context.document.sourceMap.find((b) => b.blockId === c.blockId);
          const startOffset = context.document.canonicalText.indexOf(c.exactQuote);
          const safeStart = startOffset !== -1 ? startOffset : block?.canonicalStart ?? 0;
          const safeEnd = startOffset !== -1 ? startOffset + c.exactQuote.length : block?.canonicalEnd ?? safeStart + 10;

          return {
            id: `cit-${crypto.randomUUID()}`,
            blockId: c.blockId,
            pageNumber: block?.pageNumber ?? 1,
            startOffset: safeStart,
            endOffset: safeEnd,
            exactQuote: c.exactQuote,
            confidence: block?.confidence ?? 0.95,
            sourceType: block?.isOcr ? "ocr" : "digital_text",
            boundingBox: block?.boundingBox,
          };
        });

        // Safe abstention for missing clauses if extraction confidence is low
        if (rule.condition.type === "clause_presence" && rule.condition.expected === "present") {
          if (context.extractionConfidence < 0.7) {
            trace.details.abstainedReason = "Low extraction confidence (< 0.7)";
            continue; // Abstain
          }
        }

        findings.push({
          id: `find-${crypto.randomUUID()}`,
          workflow: "contract_review",
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          title: rule.name,
          explanation: this.interpolateTemplate(rule.explanationTemplate, trace.details),
          suggestedAction: rule.suggestedAction,
          suggestedPatch: rule.patchTemplate && ruleCitations.length > 0
            ? {
                startOffset: ruleCitations[0].startOffset,
                endOffset: ruleCitations[0].endOffset,
                originalText: ruleCitations[0].exactQuote,
                replacementText: rule.patchTemplate.replacementText,
                explanation: rule.patchTemplate.explanation,
              }
            : undefined,
          citations: ruleCitations,
          confidence: "high",
          decisionState: "pending",
        });
      }
    }

    return { findings, traces };
  }

  private evaluateRule(rule: PolicyRule, context: ContractEvaluationContext): RuleExecutionTrace {
    const citations: Array<{ blockId: string; exactQuote: string }> = [];
    const details: Record<string, unknown> = {};

    const passed = this.evaluateCondition(rule.condition, context, citations, details);

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      passed,
      severity: rule.severity,
      evaluatedCondition: rule.condition.type,
      details,
      citations,
    };
  }

  private evaluateCondition(
    cond: ConditionNode,
    context: ContractEvaluationContext,
    citations: Array<{ blockId: string; exactQuote: string }>,
    details: Record<string, unknown>
  ): boolean {
    switch (cond.type) {
      case "clause_presence": {
        const matchingClauses = context.clauses.filter((c) => {
          if (c.category === cond.category) return true;
          if (cond.category === "at_will") {
            const lower = (c.text + " " + (c.actor || "")).toLowerCase();
            return lower.includes("at-will") || lower.includes("at will") || lower.includes("with or without cause");
          }
          return false;
        });
        const exists = matchingClauses.length > 0;
        details.clauseCount = matchingClauses.length;
        details.category = cond.category;

        if (cond.expected === "present") {
          return exists;
        } else {
          // Expected absent (e.g. prohibited non-compete clause)
          if (exists) {
            for (const cl of matchingClauses) {
              citations.push({ blockId: cl.blockId, exactQuote: cl.text.slice(0, 150) });
            }
            return false;
          }
          return true;
        }
      }

      case "numeric_threshold": {
        let violationsFound = 0;
        for (const cl of context.clauses) {
          const numEntry = cl.numericValues?.[cond.field];
          if (numEntry !== undefined) {
            const satisfiesRequirement = this.compareNumbers(numEntry.value, cond.operator, cond.threshold);
            if (!satisfiesRequirement) {
              violationsFound++;
              details.extractedValue = numEntry.value;
              details.actualValue = numEntry.value;
              details.threshold = cond.threshold;
              details.unit = cond.unit;
              citations.push({
                blockId: cl.blockId,
                exactQuote: numEntry.rawText || cl.text.slice(0, 100),
              });
            }
          }
        }
        return violationsFound === 0;
      }

      case "prohibited_formulation": {
        const regex = new RegExp(cond.pattern, cond.caseSensitive ? "g" : "gi");
        let foundProhibited = false;

        const targetClauses = cond.scopeCategory
          ? context.clauses.filter((c) => c.category === cond.scopeCategory)
          : context.clauses;

        for (const cl of targetClauses) {
          const match = regex.exec(cl.text);
          if (match) {
            foundProhibited = true;
            details.prohibitedMatch = match[0];
            citations.push({
              blockId: cl.blockId,
              exactQuote: match[0],
            });
          }
        }
        return !foundProhibited;
      }

      case "required_exception": {
        const matchingClauses = context.clauses.filter(
          (c) =>
            c.category === cond.scopeCategory ||
            (cond.scopeCategory === "liability" && c.category === "liability_limitation") ||
            (cond.scopeCategory === "liability_limitation" && c.category === "liability")
        );
        if (matchingClauses.length === 0) return true; // Handled by clause_presence

        const aggregateText = matchingClauses.map((c) => c.text.toLowerCase()).join(" ");
        const missingExceptions: string[] = [];

        const checkExceptionPresent = (text: string, req: string): boolean => {
          const lower = text.toLowerCase();
          const reqLower = req.toLowerCase();
          if (lower.includes(reqLower)) return true;
          if (reqLower === "independent development" && lower.includes("independently developed")) return true;
          if (reqLower === "public knowledge" && (lower.includes("public domain") || lower.includes("publicly known") || lower.includes("publicly available"))) return true;
          if (reqLower === "compelled by law" && (lower.includes("required by law") || lower.includes("court order") || lower.includes("legal process"))) return true;
          if (reqLower === "prior inventions" && (lower.includes("personal inventions") || lower.includes("pre-existing inventions") || lower.includes("excluded inventions"))) return true;
          return false;
        };

        for (const req of cond.requiredExceptions) {
          if (!checkExceptionPresent(aggregateText, req)) {
            missingExceptions.push(req);
          }
        }

        if (missingExceptions.length > 0) {
          details.missingExceptions = missingExceptions;
          const primaryClause = matchingClauses[0];
          citations.push({
            blockId: primaryClause.blockId,
            exactQuote: primaryClause.text.slice(0, 120),
          });
          return false;
        }
        return true;
      }

      case "party_asymmetry": {
        const matchingClauses = context.clauses.filter((c) => c.category === cond.obligationCategory);
        if (matchingClauses.length === 0) return true;

        const allText = matchingClauses.map((c) => c.text.toLowerCase()).join(" ");
        const hasMutual = allText.includes("each party") || allText.includes("either party") || allText.includes("both parties") || allText.includes("mutual") || allText.includes("mutually");
        if (hasMutual) {
          return true;
        }

        for (const cl of matchingClauses) {
          if (cl.isBilateral === false) {
            details.asymmetricParty = cl.actor || "unilateral";
            citations.push({
              blockId: cl.blockId,
              exactQuote: cl.text.slice(0, 120),
            });
            return false;
          }
        }
        return true;
      }

      case "broken_cross_reference": {
        let brokenFound = false;
        for (const cl of context.clauses) {
          if (cl.referencedClauses && cl.referencedClauses.length > 0) {
            for (const ref of cl.referencedClauses) {
              const cleanRef = ref.replace(/^(section|article|clause)\s+/i, "").trim();
              if (!context.definedSections.has(cleanRef) && !context.definedSections.has(ref)) {
                brokenFound = true;
                details.brokenReference = ref;
                details.brokenRef = ref;
                citations.push({
                  blockId: cl.blockId,
                  exactQuote: cl.text.slice(0, 100),
                });
              }
            }
          }
        }
        return !brokenFound;
      }

      case "logical_and": {
        for (const child of cond.conditions) {
          if (!this.evaluateCondition(child, context, citations, details)) {
            return false;
          }
        }
        return true;
      }

      case "logical_or": {
        for (const child of cond.conditions) {
          if (this.evaluateCondition(child, context, citations, details)) {
            return true;
          }
        }
        return false;
      }

      case "logical_not": {
        const childPassed = this.evaluateCondition(cond.condition, context, citations, details);
        return !childPassed;
      }

      default:
        return true;
    }
  }

  private compareNumbers(val: number, op: NumericOperator, threshold: number): boolean {
    switch (op) {
      case ">": return val > threshold;
      case "<": return val < threshold;
      case ">=": return val >= threshold;
      case "<=": return val <= threshold;
      case "==": return val === threshold;
      case "!=": return val !== threshold;
      default: return false;
    }
  }

  private interpolateTemplate(template: string, details: Record<string, unknown>): string {
    let result = template;
    for (const [key, val] of Object.entries(details)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(val));
    }
    return result;
  }
}
