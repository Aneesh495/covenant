import { DocumentIR } from "@covenant/document-ir";
import {
  CandidateProfile,
  RoleRequirement,
  RequirementMatch,
  RequirementCoverageMatrix,
  RequirementMatchStatus,
} from "./types";
import { GroundedCitation } from "@covenant/shared";
import crypto from "crypto";

export class RequirementCoverageMatcher {
  matchCoverage(
    profile: CandidateProfile,
    requirements: RoleRequirement[],
    doc: DocumentIR
  ): RequirementCoverageMatrix {
    const matches: RequirementMatch[] = [];

    for (const req of requirements) {
      const match = this.evaluateSingleRequirement(req, profile, doc);
      matches.push(match);
    }

    // Compute matrix scores
    let requiredTotal = 0;
    let requiredEarned = 0;
    let preferredTotal = 0;
    let preferredEarned = 0;

    let supportedCount = 0;
    let partiallySupportedCount = 0;
    let unsupportedCount = 0;

    for (const m of matches) {
      if (m.status === "supported") supportedCount++;
      else if (m.status === "partially_supported") partiallySupportedCount++;
      else unsupportedCount++;

      if (m.priority === "required") {
        requiredTotal++;
        requiredEarned += m.score;
      } else {
        preferredTotal++;
        preferredEarned += m.score;
      }
    }

    const requiredMatchScore = requiredTotal > 0 ? Math.round((requiredEarned / requiredTotal) * 100) : 100;
    const preferredMatchScore = preferredTotal > 0 ? Math.round((preferredEarned / preferredTotal) * 100) : 100;

    const overallMatchScore = requiredTotal > 0 || preferredTotal > 0
      ? Math.round(
          ((requiredEarned * 0.75 + preferredEarned * 0.25) /
            (Math.max(1, requiredTotal) * 0.75 + Math.max(1, preferredTotal) * 0.25)) *
            100
        )
      : 100;

    return {
      totalRequirements: requirements.length,
      requiredCount: requiredTotal,
      preferredCount: preferredTotal,
      supportedCount,
      partiallySupportedCount,
      unsupportedCount,
      overallMatchScore,
      requiredMatchScore,
      preferredMatchScore,
      matches,
    };
  }

  private evaluateSingleRequirement(
    req: RoleRequirement,
    profile: CandidateProfile,
    doc: DocumentIR
  ): RequirementMatch {
    switch (req.category) {
      case "experience_years":
        return this.evaluateExperienceYears(req, profile, doc);
      case "education":
        return this.evaluateEducation(req, profile, doc);
      case "skill":
        return this.evaluateSkill(req, profile, doc);
      case "leadership":
        return this.evaluateLeadership(req, profile, doc);
      case "domain_knowledge":
        return this.evaluateDomainKnowledge(req, profile, doc);
      default:
        return this.evaluateSkill(req, profile, doc);
    }
  }

  private evaluateExperienceYears(
    req: RoleRequirement,
    profile: CandidateProfile,
    doc: DocumentIR
  ): RequirementMatch {
    const requiredYears = req.minYears || 3;
    const actualYears = profile.totalExperienceYears;
    const citations: GroundedCitation[] = [];

    // Attach citation to most recent or primary role
    if (profile.roles.length > 0) {
      const topRole = profile.roles[0];
      citations.push(this.buildCitation(topRole.canonicalStart, topRole.canonicalEnd, doc, `${topRole.title} at ${topRole.company}`));
    }

    if (actualYears >= requiredYears) {
      return {
        requirementId: req.id,
        requirementText: req.rawText,
        category: req.category,
        priority: req.priority,
        status: "supported",
        score: 1.0,
        explanation: `Candidate has ${actualYears} years of non-overlapping experience, satisfying the requirement of ${requiredYears}+ years.`,
        citations,
      };
    } else if (actualYears >= requiredYears * 0.65) {
      return {
        requirementId: req.id,
        requirementText: req.rawText,
        category: req.category,
        priority: req.priority,
        status: "partially_supported",
        score: 0.6,
        explanation: `Candidate has ${actualYears} years of experience, slightly under the desired ${requiredYears}+ years.`,
        citations,
      };
    } else {
      return {
        requirementId: req.id,
        requirementText: req.rawText,
        category: req.category,
        priority: req.priority,
        status: "unsupported",
        score: 0.2,
        explanation: `Candidate has ${actualYears} years of experience, which does not meet the required ${requiredYears}+ years.`,
        citations,
      };
    }
  }

  private evaluateEducation(
    req: RoleRequirement,
    profile: CandidateProfile,
    doc: DocumentIR
  ): RequirementMatch {
    const citations: GroundedCitation[] = [];

    if (profile.education.length === 0) {
      return {
        requirementId: req.id,
        requirementText: req.rawText,
        category: req.category,
        priority: req.priority,
        status: "unsupported",
        score: 0.0,
        explanation: "No formal degree or educational history listed on resume.",
        citations: [],
      };
    }

    for (const edu of profile.education) {
      citations.push(this.buildCitation(edu.canonicalStart, edu.canonicalEnd, doc, edu.institution));
    }

    const hasDegree = profile.education.some((e) => e.degree !== undefined);
    return {
      requirementId: req.id,
      requirementText: req.rawText,
      category: req.category,
      priority: req.priority,
      status: hasDegree ? "supported" : "partially_supported",
      score: hasDegree ? 1.0 : 0.7,
      explanation: hasDegree
        ? `Candidate holds degree: ${profile.education[0].degree} from ${profile.education[0].institution}.`
        : `Candidate attended ${profile.education[0].institution}.`,
      citations,
    };
  }

  private evaluateSkill(
    req: RoleRequirement,
    profile: CandidateProfile,
    doc: DocumentIR
  ): RequirementMatch {
    const reqTerms = req.normalizedTerms;
    const citations: GroundedCitation[] = [];

    if (reqTerms.length === 0) {
      // Lexical check against rawText
      return this.evaluateLexicalMatch(req, profile, doc);
    }

    let matchedCount = 0;
    const matchedSkillNames: string[] = [];

    for (const term of reqTerms) {
      const found = profile.skills.find(
        (s) => s.normalizedName === term || s.name.toLowerCase() === term
      );

      if (found) {
        matchedCount++;
        matchedSkillNames.push(found.name);

        if (found.canonicalStart !== undefined && found.canonicalEnd !== undefined) {
          citations.push(this.buildCitation(found.canonicalStart, found.canonicalEnd, doc, found.evidenceText || found.name));
        }
      }
    }

    const matchRatio = matchedCount / reqTerms.length;

    if (matchRatio >= 0.99) {
      return {
        requirementId: req.id,
        requirementText: req.rawText,
        category: req.category,
        priority: req.priority,
        status: "supported",
        score: 1.0,
        explanation: `Demonstrated experience with all required technologies: ${matchedSkillNames.join(", ")}.`,
        citations,
      };
    } else if (matchRatio > 0) {
      const missing = reqTerms.filter((t) => !matchedSkillNames.map((m) => m.toLowerCase()).includes(t));
      return {
        requirementId: req.id,
        requirementText: req.rawText,
        category: req.category,
        priority: req.priority,
        status: "partially_supported",
        score: Math.round(matchRatio * 100) / 100,
        explanation: `Demonstrated experience with ${matchedSkillNames.join(", ")}, but lacks explicit evidence for ${missing.join(", ")}.`,
        citations,
      };
    } else {
      return {
        requirementId: req.id,
        requirementText: req.rawText,
        category: req.category,
        priority: req.priority,
        status: "unsupported",
        score: 0.0,
        explanation: `No evidence found on resume for requested technologies: ${reqTerms.join(", ")}.`,
        citations: [],
      };
    }
  }

  private evaluateLeadership(
    req: RoleRequirement,
    profile: CandidateProfile,
    doc: DocumentIR
  ): RequirementMatch {
    const citations: GroundedCitation[] = [];
    let leadershipEvidenceFound = false;
    let evidenceQuote = "";

    for (const role of profile.roles) {
      if (/lead|manager|head|principal|director/i.test(role.title)) {
        leadershipEvidenceFound = true;
        evidenceQuote = role.title;
        citations.push(this.buildCitation(role.canonicalStart, role.canonicalEnd, doc, role.title));
      }

      for (const bullet of role.bullets) {
        if (/mentor|led|lead|spearheaded|managed|cross-functional|directed/i.test(bullet.text)) {
          leadershipEvidenceFound = true;
          evidenceQuote = bullet.text;
          citations.push(this.buildCitation(bullet.canonicalStart, bullet.canonicalEnd, doc, bullet.text));
          break;
        }
      }
    }

    if (leadershipEvidenceFound) {
      return {
        requirementId: req.id,
        requirementText: req.rawText,
        category: req.category,
        priority: req.priority,
        status: "supported",
        score: 1.0,
        explanation: `Demonstrated leadership and cross-functional experience (${evidenceQuote.slice(0, 80)}...).`,
        citations,
      };
    }

    return {
      requirementId: req.id,
      requirementText: req.rawText,
      category: req.category,
      priority: req.priority,
      status: "partially_supported",
      score: 0.5,
      explanation: "Limited explicit team leadership or management evidence found in role descriptions.",
      citations: [],
    };
  }

  private evaluateDomainKnowledge(
    req: RoleRequirement,
    profile: CandidateProfile,
    doc: DocumentIR
  ): RequirementMatch {
    return this.evaluateLexicalMatch(req, profile, doc);
  }

  private evaluateLexicalMatch(
    req: RoleRequirement,
    profile: CandidateProfile,
    doc: DocumentIR
  ): RequirementMatch {
    const words = req.rawText.toLowerCase().match(/[a-z]{4,}/g) || [];
    const citations: GroundedCitation[] = [];

    for (const role of profile.roles) {
      for (const bullet of role.bullets) {
        const bulletLower = bullet.text.toLowerCase();
        let matchCount = 0;
        for (const w of words) {
          if (bulletLower.includes(w)) matchCount++;
        }
        if (matchCount >= 2) {
          citations.push(this.buildCitation(bullet.canonicalStart, bullet.canonicalEnd, doc, bullet.text));
          return {
            requirementId: req.id,
            requirementText: req.rawText,
            category: req.category,
            priority: req.priority,
            status: "supported",
            score: 0.85,
            explanation: `Relevant experience identified: "${bullet.text.slice(0, 100)}..."`,
            citations,
          };
        }
      }
    }

    return {
      requirementId: req.id,
      requirementText: req.rawText,
      category: req.category,
      priority: req.priority,
      status: "unsupported",
      score: 0.1,
      explanation: `No direct evidence found on resume for "${req.rawText}".`,
      citations: [],
    };
  }

  private buildCitation(start: number, end: number, doc: DocumentIR, quote: string): GroundedCitation {
    const block = doc.sourceMap.find((s) => s.canonicalStart <= start && s.canonicalEnd >= end) || doc.sourceMap[0];
    return {
      id: `cit-${crypto.randomUUID()}`,
      blockId: block?.blockId || "b-unknown",
      pageNumber: block?.pageNumber || 1,
      startOffset: start,
      endOffset: end,
      exactQuote: doc.canonicalText.slice(start, end).trim() || quote,
      confidence: block?.confidence || 0.95,
      sourceType: block?.isOcr ? "ocr" : "digital_text",
    };
  }
}
