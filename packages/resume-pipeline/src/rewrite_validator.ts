import {
  FactualValidationResult,
  BulletRevisionItem,
} from "./types";
import { SkillOntology } from "./skill_ontology";
import crypto from "crypto";

export class FactualRewriteValidator {
  private ontology = new SkillOntology();

  validateRewrite(original: string, candidate: string): FactualValidationResult {
    const violations: string[] = [];
    const preservedMetrics: string[] = [];
    const hallucinatedMetrics: string[] = [];
    const unsupportedEntities: string[] = [];

    // 1. Metric and Number Extraction
    const origNumbers = this.extractNumericTokens(original);
    const candNumbers = this.extractNumericTokens(candidate);

    // Check that every number in candidate originated in original
    const origNumberValues = new Set(origNumbers.map((n) => n.normalized));

    for (const candNum of candNumbers) {
      if (origNumberValues.has(candNum.normalized)) {
        preservedMetrics.push(candNum.raw);
      } else {
        hallucinatedMetrics.push(candNum.raw);
        violations.push(`Hallucinated metric '${candNum.raw}' was introduced without source evidence.`);
      }
    }

    // 2. Technology and Skill Entity Check
    const origSkills = new Set(this.ontology.findSkillsInText(original).map((s) => s.canonicalName));
    const candSkills = this.ontology.findSkillsInText(candidate);

    for (const skill of candSkills) {
      if (!origSkills.has(skill.canonicalName)) {
        unsupportedEntities.push(skill.canonicalName);
        violations.push(`Unsupported technology '${skill.canonicalName}' added without source mention in original text.`);
      }
    }

    // 3. Seniority and Responsibility Inventions
    const lowerOrig = original.toLowerCase();
    const lowerCand = candidate.toLowerCase();

    if (!lowerOrig.includes("lead") && !lowerOrig.includes("led") && !lowerOrig.includes("head") && !lowerOrig.includes("direct")) {
      if (lowerCand.startsWith("led ") || lowerCand.startsWith("directed ") || lowerCand.startsWith("headed ")) {
        violations.push("Scope distortion: Promoted contributor role to leadership without evidence.");
      }
    }

    if (!lowerOrig.includes("team of") && lowerCand.includes("team of")) {
      violations.push("Hallucinated team size quantification introduced in rewrite.");
    }

    const isValid = violations.length === 0;

    return {
      isValid,
      violations,
      preservedMetrics,
      hallucinatedMetrics,
      unsupportedEntities,
    };
  }

  generateVerifiedRevision(bullet: {
    text: string;
    canonicalStart: number;
    canonicalEnd: number;
    blockId: string;
  }): BulletRevisionItem | null {
    const original = bullet.text.trim();
    let candidate = original;
    let rationale = "";

    // Pattern 1: Weak opener "Responsible for [verb-ing]"
    const respForMatch = original.match(/^responsible for\s+([a-z]+ing)\s+(.*)$/i);
    if (respForMatch) {
      const verbIng = respForMatch[1].toLowerCase();
      const rest = respForMatch[2];
      const pastVerb = this.convertIngToPast(verbIng);
      candidate = `${this.capitalize(pastVerb)} ${rest}`;
      rationale = `Replaced passive opener 'Responsible for ${verbIng}' with dynamic action verb '${pastVerb}'.`;
    }

    // Pattern 2: Weak opener "Helped with [verb-ing]" or "Assisted with [verb-ing]"
    const helpedMatch = original.match(/^(?:helped with|assisted with|assisted in)\s+(?:the\s+)?([a-z]+ing)\s+(.*)$/i);
    if (!respForMatch && helpedMatch) {
      const verbIng = helpedMatch[1].toLowerCase();
      const rest = helpedMatch[2];
      const pastVerb = this.convertIngToPast(verbIng);
      candidate = `Collaborated to ${this.convertIngToPresent(verbIng)} ${rest}`;
      rationale = `Strengthened passive 'Helped with' to proactive collaboration.`;
    }

    // Pattern 3: Weak opener "Worked on [verb-ing]"
    const workedMatch = original.match(/^worked on\s+(?:the\s+)?([a-z]+ing)\s+(.*)$/i);
    if (!respForMatch && !helpedMatch && workedMatch) {
      const verbIng = workedMatch[1].toLowerCase();
      const rest = workedMatch[2];
      const pastVerb = this.convertIngToPast(verbIng);
      candidate = `${this.capitalize(pastVerb)} ${rest}`;
      rationale = `Replaced vague 'Worked on' with precise action verb '${pastVerb}'.`;
    }

    if (candidate === original) {
      return null; // No rewrite needed
    }

    // Run strict factual validation
    const validation = this.validateRewrite(original, candidate);

    return {
      id: `rev-${crypto.randomUUID()}`,
      originalText: original,
      rewrittenText: candidate,
      startOffset: bullet.canonicalStart,
      endOffset: bullet.canonicalEnd,
      blockId: bullet.blockId,
      rationale,
      validation,
      passedVerification: validation.isValid,
    };
  }

  private extractNumericTokens(text: string): Array<{ raw: string; normalized: string }> {
    const tokens: Array<{ raw: string; normalized: string }> = [];
    const regex = /\b(\$?\d+(?:,\d{3})*(?:\.\d+)?%?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b)\b/gi;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const raw = match[0];
      const normalized = raw.replace(/[$,]/g, "").toLowerCase();
      tokens.push({ raw, normalized });
    }

    return tokens;
  }

  private convertIngToPast(ingVerb: string): string {
    const map: Record<string, string> = {
      building: "built",
      designing: "designed",
      developing: "developed",
      implementing: "implemented",
      architecting: "architected",
      optimizing: "optimized",
      deploying: "deployed",
      testing: "tested",
      creating: "created",
      scaling: "scaled",
      maintaining: "maintained",
      managing: "managed",
      leading: "led",
      writing: "authored",
      supporting: "supported",
      improving: "improved",
      automating: "automated",
      refactoring: "refactored",
    };

    return map[ingVerb] || ingVerb.replace(/ing$/, "ed");
  }

  private convertIngToPresent(ingVerb: string): string {
    if (ingVerb.endsWith("ing")) {
      return ingVerb.slice(0, -3);
    }
    return ingVerb;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
