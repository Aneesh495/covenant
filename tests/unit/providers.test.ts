import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  EvidenceVerifier,
  RecordedReplayProvider,
  DeterministicFallbackEngine,
  LocalModelProvider,
  ProposedFinding,
} from "@covenant/providers";
import { DocumentIR } from "@covenant/document-ir";

function buildTestDoc(text: string): DocumentIR {
  return {
    id: "doc-test-p1",
    versionId: "v1",
    originalSha256: "b0b1b2b3b4b5b6b7b8b90123456789abcdef0123456789abcdef0123456789ab",
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
        blocks: [
          {
            id: "blk-1",
            type: "paragraph",
            canonicalStart: 0,
            canonicalEnd: text.length,
            text,
            readingOrderIndex: 0,
            confidence: 0.98,
            isOcr: false,
          },
        ],
      },
    ],
    canonicalText: text,
    sourceMap: [
      {
        blockId: "blk-1",
        pageNumber: 1,
        canonicalStart: 0,
        canonicalEnd: text.length,
        isOcr: false,
        confidence: 0.98,
      },
    ],
  };
}

describe("Model Providers & Evidence Verification", () => {
  const sampleContractText =
    "Either party may terminate this agreement upon thirty (30) days prior written notice. In no event shall liability exceed $100,000.";
  const doc = buildTestDoc(sampleContractText);

  it("verifies grounded quotes and extracts exact canonical offsets", () => {
    const verifier = new EvidenceVerifier();
    const validQuote = "thirty (30) days prior written notice";

    const result = verifier.verifyQuote(validQuote, doc);
    expect(result.isGrounded).toBe(true);
    expect(result.startOffset).toBeDefined();
    expect(result.endOffset).toBeDefined();

    const slice = doc.canonicalText.slice(result.startOffset!, result.endOffset!);
    expect(slice).toBe(validQuote);
  });

  it("strictly rejects ungrounded or hallucinated quotes absent from document", () => {
    const verifier = new EvidenceVerifier();
    const hallucinatedQuote = "Contractor agrees to indemnify client for all consequential damages";

    const result = verifier.verifyQuote(hallucinatedQuote, doc);
    expect(result.isGrounded).toBe(false);
    expect(result.rejectionReason).toContain("not found in document");
  });

  it("grounds proposed findings and drops findings with fabricated quotes", () => {
    const verifier = new EvidenceVerifier();

    // Valid finding with authentic quote
    const authenticFinding: ProposedFinding = {
      title: "Notice Period Window",
      category: "termination",
      severity: "medium",
      explanation: "Notice period is set to 30 days.",
      proposedQuote: "thirty (30) days prior written notice",
    };

    const grounded = verifier.groundProposedFinding(authenticFinding, doc, "contract_review");
    expect(grounded).not.toBeNull();
    expect(grounded?.citations.length).toBe(1);
    expect(grounded?.citations[0].exactQuote).toBe("thirty (30) days prior written notice");

    // Fabricated finding with invented quote absent from source
    const fabricatedFinding: ProposedFinding = {
      title: "Invented Non-Compete",
      category: "restrictive_covenant",
      severity: "critical",
      explanation: "Employee shall not work for any competitor worldwide for 5 years.",
      proposedQuote: "Employee shall not work for any competitor worldwide for 5 years.",
    };

    const rejected = verifier.groundProposedFinding(fabricatedFinding, doc, "contract_review");
    expect(rejected).toBeNull(); // Fabricated finding must be rejected!
  });

  it("replays recorded responses with instantaneous latency", async () => {
    const provider = new RecordedReplayProvider();
    const prompt = { userPrompt: "Analyze the notice period in this NDA." };
    const fakeResponse = {
      text: '{"noticeDays": 30}',
      parsedJson: { noticeDays: 30 },
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      latencyMs: 120,
      modelName: "test-recorded",
      providerType: "recorded" as const,
      fingerprint: "fake-hash-1",
    };

    provider.registerFixture(prompt.userPrompt, fakeResponse);

    const replayed = await provider.generateText(prompt);
    expect(replayed.text).toBe('{"noticeDays": 30}');
    expect(replayed.latencyMs).toBe(1);

    const structuredSchema = z.object({ noticeDays: z.number() });
    const structured = await provider.generateStructured(prompt, structuredSchema);
    expect(structured.data.noticeDays).toBe(30);
  });

  it("executes deterministic fallback engine when models are offline", async () => {
    const engine = new DeterministicFallbackEngine();
    expect(await engine.isAvailable()).toBe(true);

    const contractPrompt = { userPrompt: "Review this consulting contract for termination risks." };
    const contractRes = await engine.generateText(contractPrompt);
    expect(contractRes.providerType).toBe("deterministic");
    expect(contractRes.parsedJson).toBeDefined();

    const resumePrompt = { userPrompt: "Analyze this candidate resume for software engineer requirements." };
    const resumeRes = await engine.generateText(resumePrompt);
    expect(resumeRes.providerType).toBe("deterministic");
    expect(resumeRes.text).toContain("resume_intelligence");
  });

  it("detects when local model server is unavailable without crashing", async () => {
    const localProvider = new LocalModelProvider({ baseUrl: "http://127.0.0.1:59999/v1" });
    const isAvail = await localProvider.isAvailable();
    expect(isAvail).toBe(false);
  });
});
