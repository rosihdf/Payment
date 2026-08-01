export type CommissionAssignmentStatus = 'active' | 'inactive';

export interface SalesRepresentativeCommissionAssignment {
  id: string;
  salesRepresentativeId: string;
  commissionPlanVersionId: string;
  currentVersionId: string | null;
  validFrom: string;
  validUntil: string | null;
  isPrimary: boolean;
  status: CommissionAssignmentStatus;
  reason: string;
  createdByUserId: string;
  approvedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}
