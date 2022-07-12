import { DocumentIR } from "@covenant/document-ir";
import {
  ContractAnalysisOutput,
  ContractEntityGraph,
  ContractClauseNode,
} from "./types";
import { ClauseSegmenter } from "./clause_segmenter";
import { EntityExtractor } from "./entity_extractor";
import { ObligationExtractor } from "./obligation_extractor";
import {
  PolicyEvaluator,
  PolicyPlaybook,
  ContractEvaluationContext,
  getPlaybookByType,
} from "@covenant/policies";
import { GroundedFinding } from "@covenant/shared";

export interface PipelineOptions {
  playbook?: PolicyPlaybook;
  playbookType?: string; // "nda", "employment", "services"
}

export class ContractReviewPipeline {
  private segmenter = new ClauseSegmenter();
  private entityExtractor = new EntityExtractor();
  private obligationExtractor = new ObligationExtractor();
  private evaluator = new PolicyEvaluator();

  analyzeContract(doc: DocumentIR, options?: PipelineOptions): ContractAnalysisOutput {
    // 1. Reconstruct clause hierarchy
    const clauses = this.segmenter.segmentDocument(doc);

    // 2. Extract contracting parties, defined terms, governing law
    const parties = this.entityExtractor.extractParties(doc, clauses);
    const definedTerms = this.entityExtractor.extractDefinedTerms(doc, clauses);
    const governingLaw = this.entityExtractor.extractGoverningLaw(doc, clauses);

    // 3. Extract obligations and build policy evaluation entities
    const obligations = this.obligationExtractor.extractObligations(doc, clauses);
    const policyEntities = this.obligationExtractor.toPolicyEntities(clauses, obligations);

    // 4. Construct entity graph
    const entityGraph: ContractEntityGraph = {
      documentId: doc.id,
      parties,
      definedTerms,
      clauses,
      obligations,
      policyEntities,
      governingLaw,
    };

    // 5. Build set of defined section numbers and headings for cross reference checks
    const definedSections = new Set<string>();
    for (const c of clauses) {
      if (c.clauseNumber) {
        definedSections.add(c.clauseNumber);
        definedSections.add(`section ${c.clauseNumber.toLowerCase()}`);
        definedSections.add(`clause ${c.clauseNumber.toLowerCase()}`);
        definedSections.add(`article ${c.clauseNumber.toLowerCase()}`);
      }
      if (c.heading) {
        definedSections.add(c.heading.toLowerCase());
      }
    }

    // 6. Select review playbook
    let playbook: PolicyPlaybook | undefined = options?.playbook;
    if (!playbook && options?.playbookType) {
      playbook = getPlaybookByType(options.playbookType);
    }
    if (!playbook) {
      // Auto-detect playbook type from parties, headings, or content
      const inferredType = this.inferPlaybookType(doc, clauses);
      playbook = getPlaybookByType(inferredType);
    }

    let findings: GroundedFinding[] = [];
    if (playbook) {
      const allBlocks = doc.pages.flatMap((p) => p.blocks);
      const avgConfidence = allBlocks.length > 0
        ? allBlocks.reduce((acc, b) => acc + b.confidence, 0) / allBlocks.length
        : 0.95;

      const evalContext: ContractEvaluationContext = {
        document: doc,
        clauses: policyEntities,
        definedSections,
        extractionConfidence: avgConfidence,
      };

      const result = this.evaluator.evaluatePlaybook(playbook.rules, evalContext);
      findings = result.findings;

      // Verify all citations against canonical text
      this.verifyCitations(findings, doc);
    }

    // 7. Calculate summary metrics
    let criticalFindings = 0;
    let highFindings = 0;
    let mediumFindings = 0;
    let lowFindings = 0;

    for (const f of findings) {
      if (f.severity === "critical") criticalFindings++;
      else if (f.severity === "high") highFindings++;
      else if (f.severity === "medium") mediumFindings++;
      else if (f.severity === "low") lowFindings++;
    }

    const bilateralCount = obligations.filter((o) => o.isBilateral).length;
    const bilateralRatio = obligations.length > 0 ? bilateralCount / obligations.length : 1.0;

    return {
      documentId: doc.id,
      entityGraph,
      findings,
      summary: {
        totalClauses: clauses.length,
        totalObligations: obligations.length,
        criticalFindings,
        highFindings,
        mediumFindings,
        lowFindings,
        bilateralRatio: Math.round(bilateralRatio * 100) / 100,
      },
    };
  }

  private inferPlaybookType(doc: DocumentIR, clauses: ContractClauseNode[]): string {
    const textLower = doc.canonicalText.toLowerCase();

    if (
      textLower.includes("non-disclosure") ||
      textLower.includes("confidentiality agreement") ||
      textLower.includes("nda")
    ) {
      return "nda";
    }

    if (
      textLower.includes("employment agreement") ||
      textLower.includes("offer letter") ||
      textLower.includes("employee")
    ) {
      return "employment";
    }

    return "services";
  }

  private verifyCitations(findings: GroundedFinding[], doc: DocumentIR): void {
    for (const f of findings) {
      for (const cit of f.citations) {
        if (!cit.exactQuote) continue;

        const slice = doc.canonicalText.slice(cit.startOffset, cit.endOffset);
        if (slice !== cit.exactQuote) {
          // Re-align start and end offset using exact search
          const foundIdx = doc.canonicalText.indexOf(cit.exactQuote);
          if (foundIdx !== -1) {
            cit.startOffset = foundIdx;
            cit.endOffset = foundIdx + cit.exactQuote.length;
          }
        }
      }
    }
  }
}
