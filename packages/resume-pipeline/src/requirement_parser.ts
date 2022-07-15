import {
  RoleRequirement,
  RequirementCategory,
  RequirementPriority,
} from "./types";
import { SkillOntology } from "./skill_ontology";
import crypto from "crypto";

export class RoleRequirementParser {
  private ontology = new SkillOntology();

  parseJobDescription(text: string): RoleRequirement[] {
    const requirements: RoleRequirement[] = [];
    const lines = text.split("\n");

    let currentPriority: RequirementPriority = "required";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.length === 0) continue;

      const lower = line.toLowerCase();

      // Check section headers
      if (
        lower.includes("preferred") ||
        lower.includes("nice to have") ||
        lower.includes("bonus") ||
        lower.includes("plus")
      ) {
        currentPriority = "preferred";
        continue;
      }

      if (
        lower.includes("minimum qualification") ||
        lower.includes("basic qualification") ||
        lower.includes("requirements") ||
        lower.includes("what you'll need") ||
        lower.includes("what you will need") ||
        lower.includes("must have")
      ) {
        currentPriority = "required";
        continue;
      }

      // Check if line looks like a requirement bullet
      const cleanLine = line.replace(/^(?:[•\-*]|\d+[\.\)])\s*/, "").trim();

      if (cleanLine.length < 15) continue;
      // Skip generic intro/outro lines
      if (
        lower.includes("equal opportunity employer") ||
        lower.includes("about the role") ||
        lower.includes("about us") ||
        lower.includes("responsibilities:")
      ) {
        continue;
      }

      const category = this.categorizeRequirement(cleanLine);
      const minYears = this.extractYears(cleanLine);
      const degreeLevel = this.extractDegree(cleanLine);
      const normalizedTerms = this.extractTerms(cleanLine);

      requirements.push({
        id: `req-${crypto.randomUUID()}`,
        category,
        priority: currentPriority,
        rawText: cleanLine,
        normalizedTerms,
        minYears,
        degreeLevel,
      });
    }

    return requirements;
  }

  private categorizeRequirement(text: string): RequirementCategory {
    const lower = text.toLowerCase();

    if (/\b(\d+)\+?\s*years?\b/.test(lower) && (lower.includes("experience") || lower.includes("background"))) {
      return "experience_years";
    }

    if (
      lower.includes("bachelor") ||
      lower.includes("master") ||
      lower.includes("ph.d") ||
      lower.includes("degree") ||
      lower.includes("computer science") ||
      lower.includes("b.s.") ||
      lower.includes("m.s.")
    ) {
      return "education";
    }

    if (
      lower.includes("lead") ||
      lower.includes("mentor") ||
      lower.includes("manage") ||
      lower.includes("cross-functional") ||
      lower.includes("stakeholder")
    ) {
      return "leadership";
    }

    if (
      lower.includes("fintech") ||
      lower.includes("healthcare") ||
      lower.includes("security") ||
      lower.includes("compliance") ||
      lower.includes("e-commerce")
    ) {
      return "domain_knowledge";
    }

    return "skill";
  }

  private extractYears(text: string): number | undefined {
    const match = text.match(/\b(\d+)\+?\s*years?\b/i);
    return match ? parseInt(match[1], 10) : undefined;
  }

  private extractDegree(text: string): RoleRequirement["degreeLevel"] | undefined {
    const lower = text.toLowerCase();
    if (lower.includes("ph.d") || lower.includes("doctorate")) return "doctorate";
    if (lower.includes("master") || lower.includes("m.s.")) return "masters";
    if (lower.includes("bachelor") || lower.includes("b.s.")) return "bachelors";
    return undefined;
  }

  private extractTerms(text: string): string[] {
    const skills = this.ontology.findSkillsInText(text);
    return skills.map((s) => s.canonicalName.toLowerCase());
  }
}
