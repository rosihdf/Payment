import type { CommissionRuleOverride } from './commissionRuleOverride';

/** Versionierte Zuordnung inkl. individueller Overrides – Historie bleibt erhalten. */
export interface CommissionAssignmentVersion {
  id: string;
  assignmentId: string;
  salesRepresentativeId: string;
  versionNumber: number;
  commissionPlanVersionId: string;
  validFrom: string;
  validUntil: string | null;
  ruleOverrides: CommissionRuleOverride[];
  changeNote: string;
  createdByUserId: string;
  createdAt: string;
}
