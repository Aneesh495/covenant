import { DocumentIR } from "@covenant/document-ir";
import {
  CandidateProfile,
  AtsAuditResult,
  AtsCheckItem,
} from "./types";
import { GroundedFinding, GroundedCitation } from "@covenant/shared";
import crypto from "crypto";

export class AtsChecker {
  private static STRONG_ACTION_VERBS = new Set([
    "architected", "engineered", "developed", "built", "designed", "deployed",
    "scaled", "optimized", "spearheaded", "delivered", "automated", "created",
    "implemented", "led", "mentored", "orchestrated", "refactored", "migrated",
    "reduced", "increased", "accelerated", "established", "launched", "authored",
  ]);

  private static WEAK_OPENERS = [
    "responsible for", "helped with", "worked on", "assisted in", "tasks included",
    "duties included", "involved in", "part of team that",
  ];

  auditResume(profile: CandidateProfile, doc: DocumentIR): AtsAuditResult {
    const checks: AtsCheckItem[] = [];
    const findings: GroundedFinding[] = [];

    // 1. Contact Information Completeness
    const contactCheck = this.checkContactInfo(profile, doc, findings);
    checks.push(contactCheck);

    // 2. Section Structure
    const structureCheck = this.checkSectionStructure(profile, doc, findings);
    checks.push(structureCheck);

    // 3. Chronological Consistency and Gaps
    const chronologyCheck = this.checkChronology(profile, doc, findings);
    checks.push(chronologyCheck);

    // 4. Action Verb Quality
    const verbCheck = this.checkActionVerbs(profile, doc, findings);
    checks.push(verbCheck);

    // 5. Impact Quantification
    const quantCheck = this.checkQuantification(profile, doc, findings);
    checks.push(quantCheck);

    // 6. Overused Phrasing Repetition
    const repCheck = this.checkRepetition(profile, doc, findings);
    checks.push(repCheck);

    // Compute overall score
    const totalScore = checks.reduce((acc, c) => acc + c.score, 0);
    const overallScore = Math.round(totalScore / checks.length);
    const passedCount = checks.filter((c) => c.passed).length;

    return {
      overallScore,
      passedChecksCount: passedCount,
      totalChecksCount: checks.length,
      checks,
      findings,
    };
  }

  private checkContactInfo(profile: CandidateProfile, doc: DocumentIR, findings: GroundedFinding[]): AtsCheckItem {
    const missing: string[] = [];
    if (!profile.contact.email) missing.push("email address");
    if (!profile.contact.phone) missing.push("phone number");
    if (!profile.contact.location) missing.push("location / city");

    if (missing.length > 0) {
      findings.push({
        id: `find-${crypto.randomUUID()}`,
        workflow: "resume_intelligence",
        category: "ats_contact",
        severity: missing.includes("email address") ? "critical" : "medium",
        title: "Missing Essential Contact Information",
        explanation: `Resume is missing: ${missing.join(", ")}. ATS systems require complete contact details for recruiter outreach.`,
        suggestedAction: `Add your ${missing.join(" and ")} prominently at the top of the resume.`,
        citations: [],
        confidence: "high",
        decisionState: "pending",
      });

      return {
        id: "check-contact",
        name: "Contact Information Completeness",
        category: "structure",
        passed: false,
        score: Math.max(20, 100 - missing.length * 30),
        severity: "high",
        message: `Missing ${missing.join(", ")}.`,
      };
    }

    return {
      id: "check-contact",
      name: "Contact Information Completeness",
      category: "structure",
      passed: true,
      score: 100,
      severity: "info",
      message: "Complete contact information present.",
    };
  }

  private checkSectionStructure(profile: CandidateProfile, doc: DocumentIR, findings: GroundedFinding[]): AtsCheckItem {
    const missingSections: string[] = [];
    if (profile.roles.length === 0) missingSections.push("Experience");
    if (profile.education.length === 0) missingSections.push("Education");
    if (profile.skills.length === 0) missingSections.push("Skills");

    if (missingSections.length > 0) {
      findings.push({
        id: `find-${crypto.randomUUID()}`,
        workflow: "resume_intelligence",
        category: "ats_structure",
        severity: "high",
        title: "Standard Section Headings Missing",
        explanation: `Resume lacks standard section headings: ${missingSections.join(", ")}. ATS parsers rely on standard headings to index candidate history.`,
        suggestedAction: `Ensure clear headings labeled ${missingSections.join(" and ")} exist in your document.`,
        citations: [],
        confidence: "high",
        decisionState: "pending",
      });

      return {
        id: "check-structure",
        name: "Standard Section Structure",
        category: "structure",
        passed: false,
        score: Math.max(30, 100 - missingSections.length * 30),
        severity: "high",
        message: `Missing standard sections: ${missingSections.join(", ")}.`,
      };
    }

    return {
      id: "check-structure",
      name: "Standard Section Structure",
      category: "structure",
      passed: true,
      score: 100,
      severity: "info",
      message: "Standard sections (Experience, Education, Skills) detected.",
    };
  }

  private checkChronology(profile: CandidateProfile, doc: DocumentIR, findings: GroundedFinding[]): AtsCheckItem {
    if (profile.roles.length < 2) {
      return {
        id: "check-chronology",
        name: "Chronological Ordering and Career Continuity",
        category: "chronology",
        passed: true,
        score: 100,
        severity: "info",
        message: "Experience chronology valid.",
      };
    }

    // Check for employment gaps > 6 months between consecutive roles
    let hasLargeGap = false;
    let gapDescription = "";

    for (let i = 0; i < profile.roles.length - 1; i++) {
      const laterRole = profile.roles[i];
      const earlierRole = profile.roles[i + 1];

      if (laterRole.startMonthYear && earlierRole.endMonthYear && !earlierRole.isCurrent) {
        const gapMonths =
          (laterRole.startMonthYear.year * 12 + laterRole.startMonthYear.month) -
          (earlierRole.endMonthYear.year * 12 + earlierRole.endMonthYear.month);

        if (gapMonths > 6) {
          hasLargeGap = true;
          gapDescription = `${gapMonths} month gap between ${earlierRole.company} and ${laterRole.company}`;
          break;
        }
      }
    }

    if (hasLargeGap) {
      findings.push({
        id: `find-${crypto.randomUUID()}`,
        workflow: "resume_intelligence",
        category: "ats_chronology",
        severity: "medium",
        title: "Extended Employment Gap Detected",
        explanation: `Identified an employment gap exceeding 6 months: ${gapDescription}. Be prepared to explain career transitions or add freelance/educational context.`,
        suggestedAction: "Clarify any notable employment gaps with consulting, open source, or continuing education entries.",
        citations: [],
        confidence: "medium",
        decisionState: "pending",
      });

      return {
        id: "check-chronology",
        name: "Chronological Ordering and Career Continuity",
        category: "chronology",
        passed: false,
        score: 75,
        severity: "medium",
        message: `Detected extended gap: ${gapDescription}.`,
      };
    }

    return {
      id: "check-chronology",
      name: "Chronological Ordering and Career Continuity",
      category: "chronology",
      passed: true,
      score: 100,
      severity: "info",
      message: "Smooth career chronology without unexplained gaps.",
    };
  }

  private checkActionVerbs(profile: CandidateProfile, doc: DocumentIR, findings: GroundedFinding[]): AtsCheckItem {
    let totalBullets = 0;
    let weakBullets = 0;
    const weakExamples: string[] = [];
    const citations: GroundedCitation[] = [];

    for (const role of profile.roles) {
      for (const bullet of role.bullets) {
        totalBullets++;
        const lower = bullet.text.toLowerCase().trim();

        for (const weak of AtsChecker.WEAK_OPENERS) {
          if (lower.startsWith(weak)) {
            weakBullets++;
            if (weakExamples.length < 3) {
              weakExamples.push(bullet.text);
              citations.push({
                id: `cit-${crypto.randomUUID()}`,
                blockId: bullet.blockId,
                pageNumber: 1,
                startOffset: bullet.canonicalStart,
                endOffset: bullet.canonicalEnd,
                exactQuote: bullet.text,
                confidence: 0.98,
                sourceType: "digital_text",
              });
            }
            break;
          }
        }
      }
    }

    if (weakBullets > 0) {
      findings.push({
        id: `find-${crypto.randomUUID()}`,
        workflow: "resume_intelligence",
        category: "ats_action_verbs",
        severity: "medium",
        title: "Passive Openers in Experience Bullets",
        explanation: `Found ${weakBullets} bullet point(s) starting with passive language like "Responsible for" or "Helped with". Strong resumes begin with active impact verbs.`,
        suggestedAction: "Rewrite bullets using direct action verbs (e.g. Architected, Engineered, Automated, Reduced, Spearheaded).",
        citations,
        confidence: "high",
        decisionState: "pending",
      });

      return {
        id: "check-action-verbs",
        name: "Action Verb Strength",
        category: "content",
        passed: false,
        score: Math.max(40, 100 - weakBullets * 15),
        severity: "medium",
        message: `${weakBullets} bullets use passive phrases like 'Responsible for'.`,
      };
    }

    return {
      id: "check-action-verbs",
      name: "Action Verb Strength",
      category: "content",
      passed: true,
      score: 100,
      severity: "info",
      message: "Experience bullets consistently start with active impact verbs.",
    };
  }

  private checkQuantification(profile: CandidateProfile, doc: DocumentIR, findings: GroundedFinding[]): AtsCheckItem {
    let totalBullets = 0;
    let quantifiedBullets = 0;

    for (const role of profile.roles) {
      for (const bullet of role.bullets) {
        totalBullets++;
        // Check for numbers, percentages, or dollar amounts
        if (/\b\d+(?:\.\d+)?%|\$\d+|\b\d{2,}\b|\b[2-9]\s*(?:x|fold)\b/i.test(bullet.text)) {
          quantifiedBullets++;
        }
      }
    }

    if (totalBullets === 0) {
      return {
        id: "check-quantification",
        name: "Impact Quantification",
        category: "quantification",
        passed: false,
        score: 40,
        severity: "medium",
        message: "No experience bullets found to evaluate.",
      };
    }

    const ratio = quantifiedBullets / totalBullets;
    const percentage = Math.round(ratio * 100);

    if (ratio < 0.35) {
      findings.push({
        id: `find-${crypto.randomUUID()}`,
        workflow: "resume_intelligence",
        category: "ats_quantification",
        severity: "medium",
        title: "Low Metric and Impact Quantification",
        explanation: `Only ${percentage}% of bullet points include measurable metrics, percentages, or scale indicators. Aim for at least 40% to show proven business results.`,
        suggestedAction: "Incorporate concrete business outcomes (e.g. latency reductions, scale in QPS, cost savings, user growth).",
        citations: [],
        confidence: "high",
        decisionState: "pending",
      });

      return {
        id: "check-quantification",
        name: "Impact Quantification",
        category: "quantification",
        passed: false,
        score: Math.max(30, percentage * 2),
        severity: "medium",
        message: `Only ${percentage}% of bullets contain quantified metrics (recommended >= 40%).`,
      };
    }

    return {
      id: "check-quantification",
      name: "Impact Quantification",
      category: "quantification",
      passed: true,
      score: 100,
      severity: "info",
      message: `${percentage}% of bullets contain quantifiable metrics.`,
    };
  }

  private checkRepetition(profile: CandidateProfile, doc: DocumentIR, findings: GroundedFinding[]): AtsCheckItem {
    const verbCounts = new Map<string, number>();

    for (const role of profile.roles) {
      for (const bullet of role.bullets) {
        const firstWord = (bullet.text.trim().split(/\s+/)[0] || "").toLowerCase().replace(/[^a-z]/g, "");
        if (firstWord.length > 3) {
          verbCounts.set(firstWord, (verbCounts.get(firstWord) || 0) + 1);
        }
      }
    }

    const overused: string[] = [];
    for (const [verb, count] of Array.from(verbCounts.entries())) {
      if (count > 3) {
        overused.push(`"${verb}" (${count}x)`);
      }
    }

    if (overused.length > 0) {
      findings.push({
        id: `find-${crypto.randomUUID()}`,
        workflow: "resume_intelligence",
        category: "ats_repetition",
        severity: "low",
        title: "Repetitive Action Verbs",
        explanation: `Detected repetitive bullet starters: ${overused.join(", ")}. Varying your language keeps recruiter interest high.`,
        suggestedAction: "Diversify sentence openers with dynamic synonyms.",
        citations: [],
        confidence: "high",
        decisionState: "pending",
      });

      return {
        id: "check-repetition",
        name: "Verbal Variety and Repetition",
        category: "content",
        passed: false,
        score: 80,
        severity: "low",
        message: `Overused verbs: ${overused.join(", ")}.`,
      };
    }

    return {
      id: "check-repetition",
      name: "Verbal Variety and Repetition",
      category: "content",
      passed: true,
      score: 100,
      severity: "info",
      message: "Good verbal diversity across bullet openers.",
    };
  }
}
