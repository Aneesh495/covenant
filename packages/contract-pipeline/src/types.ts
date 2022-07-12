import { GroundedFinding, GroundedCitation } from "@covenant/shared";
import { DocumentIR } from "@covenant/document-ir";
import { ExtractedClauseEntity } from "@covenant/policies";

export type ModalityType =
  | "shall"
  | "must"
  | "will"
  | "may"
  | "shall_not"
  | "must_not"
  | "should";

export interface ContractClauseNode {
  id: string;
  clauseNumber: string; // e.g. "1.1", "Section 2", "Article IV", or "" for preamble
  heading: string;
  level: number; // 1 for Section 1, 2 for 1.1, etc.
  parentId?: string;
  childClauseIds: string[];
  blockIds: string[];
  pageNumber: number;
  canonicalStart: number;
  canonicalEnd: number;
  bodyText: string;
  fullText: string;
  category?: string; // e.g. "confidentiality", "termination", "governing_law"
}

export interface ExtractedParty {
  id: string;
  name: string;
  shortName?: string; // e.g. "Company", "Contractor", "Employee", "Disclosing Party"
  role: string;
  canonicalStart: number;
  canonicalEnd: number;
  blockId: string;
}

export interface DefinedTerm {
  term: string;
  definition: string;
  canonicalStart: number;
  canonicalEnd: number;
  blockId: string;
}

export interface ExtractedObligation {
  id: string;
  clauseId: string;
  actor: string;
  modality: ModalityType;
  action: string;
  target?: string;
  condition?: string;
  exceptions?: string[];
  isBilateral: boolean;
  numericValues: Record<string, { value: number; unit: string; rawText: string }>;
  canonicalStart: number;
  canonicalEnd: number;
  exactQuote: string;
  blockId: string;
}

export interface ContractEntityGraph {
  documentId: string;
  parties: ExtractedParty[];
  definedTerms: DefinedTerm[];
  clauses: ContractClauseNode[];
  obligations: ExtractedObligation[];
  policyEntities: ExtractedClauseEntity[];
  governingLaw?: { jurisdiction: string; canonicalStart: number; canonicalEnd: number };
}

export type TokenDiffOp = "equal" | "insert" | "delete";

export interface TokenDiffEntry {
  op: TokenDiffOp;
  token: string;
}

export type AlignmentType =
  | "identical"
  | "modified"
  | "moved"
  | "added"
  | "deleted";

export interface ClauseAlignmentPair {
  baseClause?: ContractClauseNode;
  targetClause?: ContractClauseNode;
  alignmentType: AlignmentType;
  similarityScore: number; // 0.0 to 1.0
  tokenDiffs: TokenDiffEntry[];
  numericChanges: Array<{
    field: string;
    oldValue?: number;
    newValue?: number;
    unit: string;
    description: string;
  }>;
  obligationChanges: Array<{
    description: string;
    type: "added" | "removed" | "modality_shift";
  }>;
}

export interface ContractComparisonResult {
  baseDocumentId: string;
  targetDocumentId: string;
  baseVersionSha256: string;
  targetVersionSha256: string;
  alignments: ClauseAlignmentPair[];
  summary: {
    totalClausesBase: number;
    totalClausesTarget: number;
    identicalCount: number;
    modifiedCount: number;
    addedCount: number;
    deletedCount: number;
    movedCount: number;
    highRiskChangesCount: number;
  };
}

export interface ContractAnalysisOutput {
  documentId: string;
  entityGraph: ContractEntityGraph;
  findings: GroundedFinding[];
  summary: {
    totalClauses: number;
    totalObligations: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
    bilateralRatio: number;
  };
}
