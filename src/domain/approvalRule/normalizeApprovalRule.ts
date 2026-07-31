import type { ApprovalRule } from './approvalRule';
import { APPROVAL_RULE_SCHEMA_VERSION } from './approvalRule';

export function normalizeApprovalRule(raw: unknown): ApprovalRule | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const entry = raw as Record<string, unknown>;
  const id = typeof entry.id === 'string' ? entry.id : '';
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  const type = typeof entry.type === 'string' ? entry.type : '';

  if (!id || !name || !type) {
    return null;
  }

  const reviewerRole = entry.requiredReviewerRole;
  const normalizedReviewerRole =
    reviewerRole === 'admin' || reviewerRole === 'reviewer' || reviewerRole === 'sales_lead'
      ? reviewerRole
      : 'admin';

  const thresholdUnit = entry.thresholdUnit;
  const normalizedThresholdUnit =
    thresholdUnit === 'cents' ||
    thresholdUnit === 'percent_tenths' ||
    thresholdUnit === 'months' ||
    thresholdUnit === 'none'
      ? thresholdUnit
      : 'none';

  return {
    id,
    schemaVersion:
      typeof entry.schemaVersion === 'number' ? entry.schemaVersion : APPROVAL_RULE_SCHEMA_VERSION,
    name,
    description: typeof entry.description === 'string' ? entry.description : '',
    type: type as ApprovalRule['type'],
    status: entry.status === 'inactive' ? 'inactive' : 'active',
    priority: typeof entry.priority === 'number' ? entry.priority : 100,
    thresholdValue: typeof entry.thresholdValue === 'number' ? entry.thresholdValue : null,
    thresholdUnit: normalizedThresholdUnit,
    tariffId: typeof entry.tariffId === 'string' ? entry.tariffId : null,
    requiredReviewerRole: normalizedReviewerRole,
    fourEyesRequired: entry.fourEyesRequired === true,
    validFrom: typeof entry.validFrom === 'string' ? entry.validFrom : null,
    validUntil: typeof entry.validUntil === 'string' ? entry.validUntil : null,
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '2026-01-01T00:00:00.000Z',
    updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '2026-01-01T00:00:00.000Z',
    createdByUserId: typeof entry.createdByUserId === 'string' ? entry.createdByUserId : 'system',
  };
}

export function normalizeApprovalRules(raw: unknown): ApprovalRule[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => normalizeApprovalRule(entry))
    .filter((entry): entry is ApprovalRule => entry !== null);
}
