import { FindingSeverity } from "@covenant/shared";

export type ConditionNodeType =
  | "clause_presence"
  | "numeric_threshold"
  | "prohibited_formulation"
  | "required_exception"
  | "party_asymmetry"
  | "broken_cross_reference"
  | "logical_and"
  | "logical_or"
  | "logical_not";

export interface BaseConditionNode {
  type: ConditionNodeType;
}

export interface ClausePresenceConditionNode extends BaseConditionNode {
  type: "clause_presence";
  category: string;
  expected: "present" | "absent";
}

export type NumericOperator = ">" | "<" | ">=" | "<=" | "==" | "!=";
export type NumericUnit = "days" | "months" | "years" | "usd" | "percent" | "count";

export interface NumericThresholdConditionNode extends BaseConditionNode {
  type: "numeric_threshold";
  field: string; // e.g. "notice_period_days", "liability_cap_usd", "payment_net_days"
  operator: NumericOperator;
  threshold: number;
  unit: NumericUnit;
}

export interface ProhibitedFormulationConditionNode extends BaseConditionNode {
  type: "prohibited_formulation";
  pattern: string; // regex or phrase
  scopeCategory?: string;
  caseSensitive?: boolean;
}

export interface RequiredExceptionConditionNode extends BaseConditionNode {
  type: "required_exception";
  scopeCategory: string; // e.g. "liability_limitation" or "confidentiality"
  requiredExceptions: string[]; // e.g. ["gross negligence", "willful misconduct", "confidentiality breach"]
}

export interface PartyAsymmetryConditionNode extends BaseConditionNode {
  type: "party_asymmetry";
  obligationCategory: string; // e.g. "confidentiality", "indemnification", "termination"
  requiredSymmetry: "bilateral" | "unilateral";
}

export interface BrokenCrossReferenceConditionNode extends BaseConditionNode {
  type: "broken_cross_reference";
}

export interface LogicalAndConditionNode extends BaseConditionNode {
  type: "logical_and";
  conditions: ConditionNode[];
}

export interface LogicalOrConditionNode extends BaseConditionNode {
  type: "logical_or";
  conditions: ConditionNode[];
}

export interface LogicalNotConditionNode extends BaseConditionNode {
  type: "logical_not";
  condition: ConditionNode;
}

export type ConditionNode =
  | ClausePresenceConditionNode
  | NumericThresholdConditionNode
  | ProhibitedFormulationConditionNode
  | RequiredExceptionConditionNode
  | PartyAsymmetryConditionNode
  | BrokenCrossReferenceConditionNode
  | LogicalAndConditionNode
  | LogicalOrConditionNode
  | LogicalNotConditionNode;

export interface PolicyRule {
  id: string;
  version: string;
  name: string;
  category: string;
  severity: FindingSeverity;
  description: string;
  condition: ConditionNode;
  explanationTemplate: string;
  suggestedAction?: string;
  patchTemplate?: {
    replacementText: string;
    explanation: string;
  };
}

export interface PolicyPlaybook {
  id: string;
  name: string;
  version: string;
  documentType: "contract" | "employment" | "nda" | "services";
  description: string;
  rules: PolicyRule[];
}

export interface RuleExecutionTrace {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  severity: FindingSeverity;
  evaluatedCondition: ConditionNodeType;
  details: Record<string, unknown>;
  citations: Array<{
    blockId: string;
    exactQuote: string;
  }>;
}
