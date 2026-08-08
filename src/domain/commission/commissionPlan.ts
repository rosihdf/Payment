export type CommissionPlanKind =
  | 'classic'
  | 'variable'
  | 'variable_model_1'
  | 'variable_model_2'
  | 'hybrid'
  | 'individual'
  | 'campaign';

export type CommissionPlanStatus = 'active' | 'inactive';

export type CommissionPlanVersionStatus = 'draft' | 'published' | 'archived';

export interface CommissionPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  planKind: CommissionPlanKind;
  status: CommissionPlanStatus;
  internalNote: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface CommissionPlanVersion {
  id: string;
  commissionPlanId: string;
  versionNumber: number;
  status: CommissionPlanVersionStatus;
  validFrom: string;
  validUntil: string | null;
  predecessorVersionId: string | null;
  createdByUserId: string;
  publishedByUserId: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  changeNote: string;
  createdAt: string;
  updatedAt: string;
}
