import {
  PolicyRule,
  PolicyPlaybook,
  ConditionNode,
  NumericOperator,
  NumericUnit,
} from "./ast";
import { FindingSeverity, PolicyExecutionError } from "@covenant/shared";

export function parsePolicyPlaybookJson(jsonString: string): PolicyPlaybook {
  try {
    const raw = JSON.parse(jsonString);
    validatePlaybook(raw);
    return raw as PolicyPlaybook;
  } catch (err) {
    throw new PolicyExecutionError(
      `Failed to parse policy playbook: ${err instanceof Error ? err.message : String(err)}`,
      "POLICY_SYNTAX_ERROR"
    );
  }
}

export function validatePlaybook(playbook: any): void {
  if (!playbook || typeof playbook !== "object") {
    throw new PolicyExecutionError("Playbook must be an object", "POLICY_SYNTAX_ERROR");
  }
  if (!playbook.id || !playbook.name || !playbook.version || !Array.isArray(playbook.rules)) {
    throw new PolicyExecutionError("Playbook missing required metadata (id, name, version, rules)", "POLICY_SYNTAX_ERROR");
  }

  for (const rule of playbook.rules) {
    validateRule(rule);
  }
}

export function validateRule(rule: any): void {
  if (!rule.id || !rule.name || !rule.category || !rule.severity || !rule.condition) {
    throw new PolicyExecutionError(`Rule ${rule?.id || "unknown"} missing required fields`, "POLICY_SYNTAX_ERROR");
  }

  const validSeverities: FindingSeverity[] = ["critical", "high", "medium", "low", "info"];
  if (!validSeverities.includes(rule.severity)) {
    throw new PolicyExecutionError(`Invalid severity '${rule.severity}' in rule ${rule.id}`, "POLICY_TYPE_ERROR");
  }

  validateCondition(rule.condition, rule.id);
}

export function validateCondition(cond: ConditionNode, ruleId: string): void {
  if (!cond || !cond.type) {
    throw new PolicyExecutionError(`Invalid condition node in rule ${ruleId}`, "POLICY_SYNTAX_ERROR");
  }

  switch (cond.type) {
    case "clause_presence":
      if (!cond.category || !cond.expected) {
        throw new PolicyExecutionError(`clause_presence missing category or expected in rule ${ruleId}`, "POLICY_TYPE_ERROR");
      }
      break;

    case "numeric_threshold":
      if (!cond.field || !cond.operator || typeof cond.threshold !== "number" || !cond.unit) {
        throw new PolicyExecutionError(`numeric_threshold invalid specification in rule ${ruleId}`, "POLICY_TYPE_ERROR");
      }
      const validOps: NumericOperator[] = [">", "<", ">=", "<=", "==", "!="];
      if (!validOps.includes(cond.operator)) {
        throw new PolicyExecutionError(`Unsupported numeric operator '${cond.operator}' in rule ${ruleId}`, "POLICY_TYPE_ERROR");
      }
      const validUnits: NumericUnit[] = ["days", "months", "years", "usd", "percent", "count"];
      if (!validUnits.includes(cond.unit)) {
        throw new PolicyExecutionError(`Unsupported numeric unit '${cond.unit}' in rule ${ruleId}`, "POLICY_TYPE_ERROR");
      }
      break;

    case "prohibited_formulation":
      if (!cond.pattern) {
        throw new PolicyExecutionError(`prohibited_formulation missing pattern in rule ${ruleId}`, "POLICY_TYPE_ERROR");
      }
      break;

    case "required_exception":
      if (!cond.scopeCategory || !Array.isArray(cond.requiredExceptions) || cond.requiredExceptions.length === 0) {
        throw new PolicyExecutionError(`required_exception missing scopeCategory or requiredExceptions in rule ${ruleId}`, "POLICY_TYPE_ERROR");
      }
      break;

    case "party_asymmetry":
      if (!cond.obligationCategory || !cond.requiredSymmetry) {
        throw new PolicyExecutionError(`party_asymmetry missing obligationCategory or requiredSymmetry in rule ${ruleId}`, "POLICY_TYPE_ERROR");
      }
      break;

    case "broken_cross_reference":
      // Valid without extra arguments
      break;

    case "logical_and":
    case "logical_or":
      if (!Array.isArray(cond.conditions) || cond.conditions.length === 0) {
        throw new PolicyExecutionError(`Logical compound condition must contain child conditions in rule ${ruleId}`, "POLICY_SYNTAX_ERROR");
      }
      for (const child of cond.conditions) {
        validateCondition(child, ruleId);
      }
      break;

    case "logical_not":
      if (!cond.condition) {
        throw new PolicyExecutionError(`logical_not condition missing child condition in rule ${ruleId}`, "POLICY_SYNTAX_ERROR");
      }
      validateCondition(cond.condition, ruleId);
      break;

    default:
      throw new PolicyExecutionError(`Unknown condition type '${(cond as any).type}' in rule ${ruleId}`, "POLICY_TYPE_ERROR");
  }
}

export class PolicyParser {
  static parsePlaybookJson(jsonString: string): PolicyPlaybook {
    return parsePolicyPlaybookJson(jsonString);
  }

  static validatePlaybook(playbook: any): { isValid: boolean; errors: string[] } {
    try {
      validatePlaybook(playbook);
      return { isValid: true, errors: [] };
    } catch (err: any) {
      return { isValid: false, errors: [err.message] };
    }
  }

  static validateRule(rule: any): { isValid: boolean; errors: string[] } {
    try {
      validateRule(rule);
      return { isValid: true, errors: [] };
    } catch (err: any) {
      return { isValid: false, errors: [err.message] };
    }
  }
}
