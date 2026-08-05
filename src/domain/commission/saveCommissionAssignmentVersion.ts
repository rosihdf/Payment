import type { CommissionRuleOverride } from './commissionRuleOverride';
import type { SalesRepresentativeCommissionAssignment } from './commissionAssignment';

export interface SaveCommissionAssignmentVersionInput {
  salesRepresentativeId: string;
  commissionPlanVersionId: string;
  validFrom: string;
  validUntil: string | null;
  ruleOverrides: CommissionRuleOverride[];
  changeNote: string;
  expectedCurrentVersionId?: string | null;
}

export type SaveCommissionAssignmentVersionResult =
  | {
      ok: true;
      unchanged: boolean;
      assignment: SalesRepresentativeCommissionAssignment;
      currentVersionId: string;
      versionNumber: number;
    }
  | { ok: false; error: string };
