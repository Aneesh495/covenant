export * from "./nda";
export * from "./employment";
export * from "./services";

import { PolicyPlaybook } from "../ast";
import { NdaPlaybook } from "./nda";
import { EmploymentPlaybook } from "./employment";
import { ServicesAgreementPlaybook } from "./services";

export const BUILTIN_PLAYBOOKS: Record<string, PolicyPlaybook> = {
  nda: NdaPlaybook,
  employment: EmploymentPlaybook,
  services: ServicesAgreementPlaybook,
};

export function getPlaybookByType(type: string): PolicyPlaybook | undefined {
  if (type === "nda") return NdaPlaybook;
  if (type === "employment") return EmploymentPlaybook;
  if (type === "services" || type === "contract") return ServicesAgreementPlaybook;
  return BUILTIN_PLAYBOOKS[type];
}
