import { describe, it, expect } from "vitest";
import {
  PolicyEvaluator,
  PolicyParser,
  ContractEvaluationContext,
  ExtractedClauseEntity,
  NdaPlaybook,
  EmploymentPlaybook,
  ServicesAgreementPlaybook,
  PolicyRule,
} from "@covenant/policies";
import { DocumentIR } from "@covenant/document-ir";

function createMockDocument(text: string): DocumentIR {
  return {
    irVersion: "1.0.0",
    id: "doc-test-1",
    sha256: "test-sha256",
    mediaType: "application/pdf",
    extractorVersion: "test-extractor-1.0",
    createdAt: new Date().toISOString(),
    pageCount: 1,
    canonicalText: text,
    blocks: [
      {
        id: "b1",
        pageNumber: 1,
        blockType: "paragraph",
        text: text,
        readingOrderIndex: 0,
        canonicalStart: 0,
        canonicalEnd: text.length,
        confidence: 0.98,
        isOcr: false,
      },
    ],
    headings: [],
    sourceMap: [
      {
        blockId: "b1",
        pageNumber: 1,
        canonicalStart: 0,
        canonicalEnd: text.length,
        readingOrderIndex: 0,
        isOcr: false,
        confidence: 0.98,
      },
    ],
    quality: {
      ocrApplied: false,
      overallConfidence: 0.98,
      repeatedHeaderCount: 0,
      readingOrderConfidence: 1.0,
      characterCount: text.length,
    },
  };
}

describe("Policy Engine & DSL", () => {
  const evaluator = new PolicyEvaluator();

  it("validates playbook schema and detects invalid rule nodes", () => {
    const invalidPlaybook = {
      id: "bad-playbook",
      name: "Bad Playbook",
      version: "1.0",
      category: "nda",
      rules: [
        {
          id: "", // Invalid empty id
          name: "Empty ID Rule",
          category: "test",
          severity: "high",
          condition: { type: "clause_presence", category: "confidentiality", expected: "present" },
          explanationTemplate: "Missing",
          suggestedAction: "Add it",
        },
      ],
    };

    const validation = PolicyParser.validatePlaybook(invalidPlaybook);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it("evaluates clause presence and missing-clause abstention on low confidence", () => {
    const text = "This agreement governs confidential information between parties.";
    const doc = createMockDocument(text);

    const rule: PolicyRule = {
      id: "rule-ip-ownership",
      name: "IP Assignment Required",
      category: "ip_assignment",
      severity: "critical",
      condition: {
        type: "clause_presence",
        category: "ip_assignment",
        expected: "present",
      },
      explanationTemplate: "Document lacks intellectual property assignment clause.",
      suggestedAction: "Insert standard IP assignment language.",
    };

    // Case 1: High confidence, missing clause -> produces finding
    const highConfContext: ContractEvaluationContext = {
      document: doc,
      clauses: [],
      definedSections: new Set(["1.0"]),
      extractionConfidence: 0.95,
    };

    const resHigh = evaluator.evaluatePlaybook([rule], highConfContext);
    expect(resHigh.findings.length).toBe(1);
    expect(resHigh.findings[0].ruleId).toBe("rule-ip-ownership");
    expect(resHigh.findings[0].severity).toBe("critical");

    // Case 2: Low confidence (< 0.7), missing clause -> abstains (no false positive)
    const lowConfContext: ContractEvaluationContext = {
      document: doc,
      clauses: [],
      definedSections: new Set(["1.0"]),
      extractionConfidence: 0.65,
    };

    const resLow = evaluator.evaluatePlaybook([rule], lowConfContext);
    expect(resLow.findings.length).toBe(0);
    expect(resLow.traces[0].details["abstainedReason"]).toBeDefined();
  });

  it("evaluates numeric thresholds for notice periods and non-compete durations", () => {
    const doc = createMockDocument("Either party may terminate upon giving 14 days written notice.");
    const clause: ExtractedClauseEntity = {
      id: "cl-1",
      category: "termination_for_convenience",
      text: "Either party may terminate upon giving 14 days written notice.",
      canonicalStart: 0,
      canonicalEnd: 62,
      blockId: "b1",
      pageNumber: 1,
      numericValues: {
        notice_period_days: { value: 14, unit: "days", rawText: "14 days" },
      },
    };

    const rule: PolicyRule = {
      id: "rule-notice-threshold",
      name: "Notice Period Must Be At Least 30 Days",
      category: "termination",
      severity: "high",
      condition: {
        type: "numeric_threshold",
        field: "notice_period_days",
        operator: ">=",
        threshold: 30,
        unit: "days",
      },
      explanationTemplate: "Notice period of {{actualValue}} days is below the required 30 days.",
      suggestedAction: "Increase notice period to at least 30 days.",
    };

    const context: ContractEvaluationContext = {
      document: doc,
      clauses: [clause],
      definedSections: new Set(["1.0"]),
      extractionConfidence: 0.95,
    };

    const result = evaluator.evaluatePlaybook([rule], context);
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].explanation).toContain("14 days is below the required 30 days");
    expect(result.findings[0].citations[0].exactQuote).toContain("14 days");
  });

  it("evaluates prohibited formulations and suggests targeted patch", () => {
    const text = "Company may terminate this agreement in its sole discretion at any time.";
    const doc = createMockDocument(text);
    const clause: ExtractedClauseEntity = {
      id: "cl-2",
      category: "termination",
      text: text,
      canonicalStart: 0,
      canonicalEnd: text.length,
      blockId: "b1",
      pageNumber: 1,
    };

    const rule: PolicyRule = {
      id: "rule-no-sole-discretion",
      name: "Prohibit Sole Discretion In Termination",
      category: "termination",
      severity: "medium",
      condition: {
        type: "prohibited_formulation",
        pattern: "sole discretion",
        scopeCategory: "termination",
      },
      explanationTemplate: "Found prohibited clause granting sole discretion.",
      suggestedAction: "Replace sole discretion with reasonable mutual criteria.",
      patchTemplate: {
        targetPhrase: "sole discretion",
        replacementText: "reasonable discretion upon mutual consultation",
        explanation: "Mitigate unilateral termination risk.",
      },
    };

    const context: ContractEvaluationContext = {
      document: doc,
      clauses: [clause],
      definedSections: new Set(["2.1"]),
      extractionConfidence: 0.95,
    };

    const result = evaluator.evaluatePlaybook([rule], context);
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].suggestedPatch).toBeDefined();
    expect(result.findings[0].suggestedPatch?.replacementText).toBe("reasonable discretion upon mutual consultation");
  });

  it("evaluates party asymmetry for indemnification obligations", () => {
    const text = "Contractor shall indemnify and hold harmless Client against all claims.";
    const doc = createMockDocument(text);
    const clause: ExtractedClauseEntity = {
      id: "cl-3",
      category: "indemnification",
      text: text,
      canonicalStart: 0,
      canonicalEnd: text.length,
      blockId: "b1",
      pageNumber: 1,
      isBilateral: false,
      actor: "Contractor",
      target: "Client",
    };

    const rule: PolicyRule = {
      id: "rule-mutual-indemnity",
      name: "Indemnification Must Be Mutual",
      category: "indemnification",
      severity: "high",
      condition: {
        type: "party_asymmetry",
        obligationCategory: "indemnification",
        requiredSymmetry: "bilateral",
      },
      explanationTemplate: "Indemnification obligation is unilateral and unreciprocated.",
      suggestedAction: "Make indemnification mutual between both parties.",
    };

    const context: ContractEvaluationContext = {
      document: doc,
      clauses: [clause],
      definedSections: new Set(["3.0"]),
      extractionConfidence: 0.95,
    };

    const result = evaluator.evaluatePlaybook([rule], context);
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].ruleId).toBe("rule-mutual-indemnity");
    expect(result.findings[0].severity).toBe("high");
  });

  it("evaluates broken cross-references to non-existent sections", () => {
    const text = "Remedies for breach are detailed in Section 14.2.";
    const doc = createMockDocument(text);
    const clause: ExtractedClauseEntity = {
      id: "cl-4",
      category: "remedies",
      text: text,
      canonicalStart: 0,
      canonicalEnd: text.length,
      blockId: "b1",
      pageNumber: 1,
      referencedClauses: ["14.2"],
    };

    const rule: PolicyRule = {
      id: "rule-broken-refs",
      name: "Check Cross References",
      category: "drafting",
      severity: "medium",
      condition: {
        type: "broken_cross_reference",
      },
      explanationTemplate: "Referenced section {{brokenRef}} does not exist in the agreement.",
      suggestedAction: "Update cross reference to an existing section.",
    };

    const context: ContractEvaluationContext = {
      document: doc,
      clauses: [clause],
      definedSections: new Set(["1.0", "2.0", "3.0"]), // Section 14.2 does not exist!
      extractionConfidence: 0.95,
    };

    const result = evaluator.evaluatePlaybook([rule], context);
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].explanation).toContain("14.2");
  });

  it("runs builtin playbooks (NDA, Employment, Services) cleanly against standard contracts", () => {
    expect(NdaPlaybook.rules.length).toBeGreaterThan(3);
    expect(EmploymentPlaybook.rules.length).toBeGreaterThan(3);
    expect(ServicesAgreementPlaybook.rules.length).toBeGreaterThan(3);

    const sampleNdaText = "This Non-Disclosure Agreement defines confidential information and non-use obligations.";
    const doc = createMockDocument(sampleNdaText);
    const context: ContractEvaluationContext = {
      document: doc,
      clauses: [
        {
          id: "cl-nda-1",
          category: "confidentiality_definition",
          text: sampleNdaText,
          canonicalStart: 0,
          canonicalEnd: sampleNdaText.length,
          blockId: "b1",
          pageNumber: 1,
          isBilateral: true,
        },
      ],
      definedSections: new Set(["1.0", "2.0", "3.0", "4.0", "5.0", "6.0"]),
      extractionConfidence: 0.95,
    };

    const ndaResult = evaluator.evaluatePlaybook(NdaPlaybook.rules, context);
    expect(ndaResult.traces.length).toBe(NdaPlaybook.rules.length);
  });
});
