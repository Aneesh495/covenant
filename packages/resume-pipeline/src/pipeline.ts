import { DocumentIR } from "@covenant/document-ir";
import {
  ResumeAnalysisOutput,
  RequirementCoverageMatrix,
  BulletRevisionItem,
} from "./types";
import { CandidateProfileExtractor } from "./profile_extractor";
import { RoleRequirementParser } from "./requirement_parser";
import { RequirementCoverageMatcher } from "./coverage_matcher";
import { AtsChecker } from "./ats_checker";
import { FactualRewriteValidator } from "./rewrite_validator";
import { GroundedFinding } from "@covenant/shared";
import crypto from "crypto";

export interface ResumePipelineOptions {
  jobDescription?: string;
  generateBulletRevisions?: boolean;
}

export class ResumeIntelligencePipeline {
  private profileExtractor = new CandidateProfileExtractor();
  private requirementParser = new RoleRequirementParser();
  private coverageMatcher = new RequirementCoverageMatcher();
  private atsChecker = new AtsChecker();
  private rewriteValidator = new FactualRewriteValidator();

  analyzeResume(doc: DocumentIR, options?: ResumePipelineOptions): ResumeAnalysisOutput {
    // 1. Extract candidate profile
    const profile = this.profileExtractor.extractProfile(doc);

    // 2. Perform ATS audit
    const atsAudit = this.atsChecker.auditResume(profile, doc);
    const findings: GroundedFinding[] = [...atsAudit.findings];

    // 3. Match against job description if provided
    let coverageMatrix: RequirementCoverageMatrix | undefined = undefined;

    if (options?.jobDescription && options.jobDescription.trim().length > 20) {
      const requirements = this.requirementParser.parseJobDescription(options.jobDescription);
      coverageMatrix = this.coverageMatcher.matchCoverage(profile, requirements, doc);

      // Create grounded findings for critical unsupported required qualifications
      for (const m of coverageMatrix.matches) {
        if (m.priority === "required" && m.status === "unsupported") {
          findings.push({
            id: `find-${crypto.randomUUID()}`,
            workflow: "resume_intelligence",
            category: "role_qualification_gap",
            severity: "high",
            title: `Missing Required Qualification: ${m.category}`,
            explanation: `The role strictly requires: "${m.requirementText}". ${m.explanation}`,
            suggestedAction: "If you have relevant background in this area, highlight it in your experience bullets or summary.",
            citations: m.citations,
            confidence: "high",
            decisionState: "pending",
          });
        }
      }
    }

    // 4. Generate and validate bullet revisions
    const bulletRevisions: BulletRevisionItem[] = [];

    if (options?.generateBulletRevisions !== false) {
      for (const role of profile.roles) {
        for (const bullet of role.bullets) {
          const rev = this.rewriteValidator.generateVerifiedRevision({
            text: bullet.text,
            canonicalStart: bullet.canonicalStart,
            canonicalEnd: bullet.canonicalEnd,
            blockId: bullet.blockId,
          });

          if (rev) {
            bulletRevisions.push(rev);

            // Add finding with suggested patch for verified revisions
            if (rev.passedVerification) {
              findings.push({
                id: `find-${crypto.randomUUID()}`,
                workflow: "resume_intelligence",
                category: "bullet_improvement",
                severity: "info",
                title: "Suggested Action Verb Enhancement",
                explanation: rev.rationale,
                suggestedAction: "Adopt active phrasing to maximize ATS scoring and readability.",
                suggestedPatch: {
                  startOffset: rev.startOffset,
                  endOffset: rev.endOffset,
                  originalText: rev.originalText,
                  replacementText: rev.rewrittenText,
                  explanation: rev.rationale,
                },
                citations: [
                  {
                    id: `cit-${crypto.randomUUID()}`,
                    blockId: rev.blockId,
                    pageNumber: 1,
                    startOffset: rev.startOffset,
                    endOffset: rev.endOffset,
                    exactQuote: rev.originalText,
                    confidence: 0.98,
                    sourceType: "digital_text",
                  },
                ],
                confidence: "high",
                decisionState: "pending",
              });
            }
          }
        }
      }
    }

    const verifiedRevisionsCount = bulletRevisions.filter((r) => r.passedVerification).length;

    return {
      documentId: doc.id,
      profile,
      coverageMatrix,
      atsAudit,
      bulletRevisions,
      findings,
      summary: {
        totalRoles: profile.roles.length,
        totalYearsExperience: profile.totalExperienceYears,
        totalSkillsCount: profile.skills.length,
        atsScore: atsAudit.overallScore,
        roleMatchScore: coverageMatrix?.overallMatchScore,
        revisionsGenerated: bulletRevisions.length,
        verifiedRevisionsCount,
      },
    };
  }
}
