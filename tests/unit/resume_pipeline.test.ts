import { describe, it, expect } from "vitest";
import {
  CandidateProfileExtractor,
  RoleRequirementParser,
  RequirementCoverageMatcher,
  AtsChecker,
  FactualRewriteValidator,
  ResumeIntelligencePipeline,
  SkillOntology,
} from "@covenant/resume-pipeline";
import { DocumentIR } from "@covenant/document-ir";

function buildResumeDocument(blocks: Array<{ text: string; type?: "paragraph" | "heading" }>): DocumentIR {
  let offset = 0;
  const canonicalParts: string[] = [];
  const irBlocks = blocks.map((b, idx) => {
    const text = b.text;
    const start = offset;
    const end = start + text.length;
    offset = end + 2; // +2 for newline separator
    canonicalParts.push(text);

    return {
      id: `blk-${idx + 1}`,
      type: b.type || "paragraph",
      canonicalStart: start,
      canonicalEnd: end,
      text,
      readingOrderIndex: idx,
      confidence: 0.98,
      isOcr: false,
    };
  });

  const canonicalText = canonicalParts.join("\n\n");

  return {
    id: "doc-test-resume-1",
    versionId: "v1",
    originalSha256: "a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef",
    mediaType: "application/pdf",
    extractorVersion: "covenant-pdf-1.0",
    extractedAt: new Date().toISOString(),
    pageCount: 1,
    pages: [
      {
        pageNumber: 1,
        width: 612,
        height: 792,
        isOcr: false,
        blocks: irBlocks,
      },
    ],
    canonicalText,
    sourceMap: irBlocks.map((b) => ({
      blockId: b.id,
      pageNumber: 1,
      canonicalStart: b.canonicalStart,
      canonicalEnd: b.canonicalEnd,
      isOcr: false,
      confidence: 0.98,
    })),
  };
}

describe("Resume Intelligence Pipeline", () => {
  const sampleResumeBlocks = [
    {
      text: "Jane Doe\njanedoe@example.com | (555) 123-4567 | San Francisco, CA | linkedin.com/in/janedoe | github.com/janedoe",
      type: "paragraph" as const,
    },
    {
      text: "PROFESSIONAL SUMMARY",
      type: "heading" as const,
    },
    {
      text: "Senior Software Engineer with deep expertise in distributed systems, TypeScript, Python, and cloud infrastructure.",
      type: "paragraph" as const,
    },
    {
      text: "EXPERIENCE",
      type: "heading" as const,
    },
    {
      text: "Senior Staff Engineer - Acme Cloud Inc | Jan 2021 - Present",
      type: "heading" as const,
    },
    {
      text: "• Architected high-throughput event processing platform handling 50,000 QPS with sub-10ms latency using Go and Kafka.\n• Reduced cloud infrastructure spend by $120,000 annually by optimizing Kubernetes cluster autoscaling.\n• Led cross-functional team of 6 engineers across 3 time zones to deliver multi-region failover.",
      type: "paragraph" as const,
    },
    {
      text: "Software Engineer - Beacon Systems | Jun 2018 - Dec 2020",
      type: "heading" as const,
    },
    {
      text: "• Responsible for developing customer-facing analytics dashboards using React, TypeScript, and PostgreSQL.\n• Helped with improving test coverage from 45% to 85% across core microservices.\n• Worked on maintaining legacy MySQL backend services.",
      type: "paragraph" as const,
    },
    {
      text: "EDUCATION",
      type: "heading" as const,
    },
    {
      text: "University of California, Berkeley\nBachelor of Science in Computer Science | 2018",
      type: "paragraph" as const,
    },
    {
      text: "TECHNICAL SKILLS",
      type: "heading" as const,
    },
    {
      text: "Languages: TypeScript, JavaScript, Python, Go, SQL\nFrameworks: React, Node.js, Express, FastAPI\nInfrastructure: Docker, Kubernetes, AWS, PostgreSQL, Redis, Git",
      type: "paragraph" as const,
    },
  ];

  it("extracts comprehensive candidate profile with deduplicated experience calculation", () => {
    const doc = buildResumeDocument(sampleResumeBlocks);
    const extractor = new CandidateProfileExtractor();
    const profile = extractor.extractProfile(doc);

    expect(profile.contact.name).toBe("Jane Doe");
    expect(profile.contact.email).toBe("janedoe@example.com");
    expect(profile.contact.phone).toBe("(555) 123-4567");
    expect(profile.contact.location).toBe("San Francisco, CA");
    expect(profile.contact.github).toContain("github.com/janedoe");

    expect(profile.roles.length).toBe(2);
    expect(profile.roles[0].company).toContain("Acme Cloud");
    expect(profile.roles[0].isCurrent).toBe(true);
    expect(profile.roles[1].company).toContain("Beacon Systems");

    // Total experience: June 2018 to Present (> 5 years)
    expect(profile.totalExperienceYears).toBeGreaterThanOrEqual(5.0);

    expect(profile.education.length).toBeGreaterThanOrEqual(1);
    expect(profile.education[0].institution).toContain("Berkeley");

    expect(profile.skills.length).toBeGreaterThan(5);
    expect(profile.skills.some((s) => s.normalizedName === "typescript")).toBe(true);
    expect(profile.skills.some((s) => s.normalizedName === "kubernetes")).toBe(true);
  });

  it("prevents double-counting overlapping job dates in experience months", () => {
    // Role 1: Jan 2020 - Dec 2021 (24 months)
    // Role 2: Jun 2020 - Jun 2021 (12 months wholly inside Role 1)
    const overlappingBlocks = [
      { text: "John Smith\njohn@example.com | (555) 999-0000 | New York, NY", type: "paragraph" as const },
      { text: "EXPERIENCE", type: "heading" as const },
      { text: "Primary Engineer - Corp A | Jan 2020 - Dec 2021", type: "heading" as const },
      { text: "• Built core backend APIs.", type: "paragraph" as const },
      { text: "Consulting Engineer - Corp B | Jun 2020 - Jun 2021", type: "heading" as const },
      { text: "• Provided auxiliary infrastructure support.", type: "paragraph" as const },
    ];

    const doc = buildResumeDocument(overlappingBlocks);
    const extractor = new CandidateProfileExtractor();
    const profile = extractor.extractProfile(doc);

    // If naive addition: 24 + 12 = 36 months (3.0 years)
    // Correct deduplicated calendar span: 24 months = 2.0 years
    expect(profile.totalExperienceYears).toBeCloseTo(2.0, 1);
  });

  it("parses job description into categorized and prioritized requirements", () => {
    const jobDescription = `
Senior Software Engineer - Distributed Systems

Minimum Qualifications:
• 5+ years of software engineering experience building scalable backend services.
• Bachelor's degree in Computer Science or equivalent practical experience.
• Strong proficiency in TypeScript, Go, or Python.
• Experience designing relational database schemas with PostgreSQL or MySQL.

Preferred Qualifications:
• Experience with Kubernetes and container orchestration in AWS or GCP.
• Proven track record leading or mentoring junior team members.
• Prior experience in fintech or payment processing.
    `;

    const parser = new RoleRequirementParser();
    const requirements = parser.parseJobDescription(jobDescription);

    expect(requirements.length).toBeGreaterThanOrEqual(6);

    const expReq = requirements.find((r) => r.category === "experience_years");
    expect(expReq).toBeDefined();
    expect(expReq?.priority).toBe("required");
    expect(expReq?.minYears).toBe(5);

    const eduReq = requirements.find((r) => r.category === "education");
    expect(eduReq).toBeDefined();
    expect(eduReq?.priority).toBe("required");

    const k8sReq = requirements.find((r) => r.rawText.includes("Kubernetes"));
    expect(k8sReq).toBeDefined();
    expect(k8sReq?.priority).toBe("preferred");

    const leadReq = requirements.find((r) => r.category === "leadership");
    expect(leadReq).toBeDefined();
  });

  it("computes hybrid requirement coverage matrix with grounded evidence", () => {
    const doc = buildResumeDocument(sampleResumeBlocks);
    const extractor = new CandidateProfileExtractor();
    const profile = extractor.extractProfile(doc);

    const parser = new RoleRequirementParser();
    const jobDescription = `
Requirements:
• 5+ years of software engineering experience.
• BS in Computer Science.
• Proficiency with TypeScript and PostgreSQL.
• Experience with Rust.
    `;
    const requirements = parser.parseJobDescription(jobDescription);

    const matcher = new RequirementCoverageMatcher();
    const matrix = matcher.matchCoverage(profile, requirements, doc);

    expect(matrix.totalRequirements).toBe(requirements.length);
    expect(matrix.supportedCount).toBeGreaterThanOrEqual(2);

    const tsMatch = matrix.matches.find((m) => m.requirementText.includes("TypeScript"));
    expect(tsMatch?.status).toBe("supported");
    expect(tsMatch?.citations.length).toBeGreaterThan(0);

    const rustMatch = matrix.matches.find((m) => m.requirementText.includes("Rust"));
    expect(rustMatch?.status).toBe("unsupported");
    expect(rustMatch?.score).toBe(0.0);
  });

  it("audits resume against ATS criteria identifying weak openers and quantification", () => {
    const doc = buildResumeDocument(sampleResumeBlocks);
    const extractor = new CandidateProfileExtractor();
    const profile = extractor.extractProfile(doc);

    const checker = new AtsChecker();
    const audit = checker.auditResume(profile, doc);

    expect(audit.totalChecksCount).toBe(6);
    expect(audit.overallScore).toBeGreaterThan(60);

    // Should flag passive openers in Beacon Systems role ("Responsible for", "Helped with", "Worked on")
    const actionVerbCheck = audit.checks.find((c) => c.id === "check-action-verbs");
    expect(actionVerbCheck?.passed).toBe(false);
    expect(actionVerbCheck?.message).toContain("Responsible for");
  });

  it("strictly validates bullet rewrites and rejects hallucinated numbers or new tools", () => {
    const validator = new FactualRewriteValidator();

    const originalBullet = "Responsible for developing customer-facing analytics dashboards using React, TypeScript, and PostgreSQL.";

    // Case 1: Legitimate rewrite converting passive opener to active verb without hallucinating facts
    const validRewrite = "Developed customer-facing analytics dashboards using React, TypeScript, and PostgreSQL.";
    const validResult = validator.validateRewrite(originalBullet, validRewrite);
    expect(validResult.isValid).toBe(true);
    expect(validResult.violations.length).toBe(0);

    // Case 2: Hallucinated metric (e.g. invented 45% latency improvement)
    const hallucinatedMetricRewrite = "Developed analytics dashboards using React, TypeScript, and PostgreSQL, improving latency by 45%.";
    const metricResult = validator.validateRewrite(originalBullet, hallucinatedMetricRewrite);
    expect(metricResult.isValid).toBe(false);
    expect(metricResult.violations.some((v) => v.includes("Hallucinated metric"))).toBe(true);

    // Case 3: Unsupported technology hallucination (e.g. inserted Kubernetes not in bullet)
    const hallucinatedTechRewrite = "Developed analytics dashboards with React, TypeScript, PostgreSQL, and Kubernetes.";
    const techResult = validator.validateRewrite(originalBullet, hallucinatedTechRewrite);
    expect(techResult.isValid).toBe(false);
    expect(techResult.violations.some((v) => v.includes("Kubernetes"))).toBe(true);

    // Case 4: Automated generator generates verified revision for weak opener
    const generated = validator.generateVerifiedRevision({
      text: originalBullet,
      canonicalStart: 100,
      canonicalEnd: 200,
      blockId: "b1",
    });
    expect(generated).not.toBeNull();
    expect(generated?.passedVerification).toBe(true);
    expect(generated?.rewrittenText).toContain("Developed customer-facing");
  });

  it("executes end-to-end ResumeIntelligencePipeline with full coverage and verified revisions", () => {
    const doc = buildResumeDocument(sampleResumeBlocks);
    const pipeline = new ResumeIntelligencePipeline();

    const jobDescription = `
Requirements:
• 4+ years software engineering experience.
• Experience with TypeScript, React, and PostgreSQL.
• Docker and Kubernetes experience.
    `;

    const result = pipeline.analyzeResume(doc, { jobDescription });

    expect(result.profile.roles.length).toBe(2);
    expect(result.coverageMatrix).toBeDefined();
    expect(result.coverageMatrix?.overallMatchScore).toBeGreaterThan(70);
    expect(result.atsAudit.overallScore).toBeGreaterThan(60);
    expect(result.bulletRevisions.length).toBeGreaterThan(0);
    expect(result.summary.verifiedRevisionsCount).toBeGreaterThan(0);

    // All verified revisions must pass factual checks
    for (const rev of result.bulletRevisions) {
      if (rev.passedVerification) {
        expect(rev.validation.isValid).toBe(true);
        expect(rev.validation.violations.length).toBe(0);
      }
    }
  });
});
