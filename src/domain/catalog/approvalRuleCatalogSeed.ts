import type { ApprovalRule } from '../approvalRule/approvalRule';

/** Produktive Ausgangskonfiguration – stabile IDs für idempotenten Bootstrap. */
export const PRODUCTION_APPROVAL_RULE_PRICE_BELOW_MINIMUM_ID = 'approval_rule_price_below_minimum';
export const PRODUCTION_APPROVAL_RULE_DISCOUNT_ABOVE_THRESHOLD_ID =
  'approval_rule_discount_above_threshold';
export const PRODUCTION_APPROVAL_RULE_MISSING_REQUIRED_DATA_ID =
  'approval_rule_missing_required_data';

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

export function createProductionApprovalRules(createdByUserId = 'system'): ApprovalRule[] {
  return [
    {
      id: PRODUCTION_APPROVAL_RULE_PRICE_BELOW_MINIMUM_ID,
      schemaVersion: 1,
      name: 'Preis unter Mindestgrenze',
      description: 'Freigabe bei Unterschreitung der Mindestpreisgrenze',
      type: 'price_below_minimum',
      status: 'active',
      priority: 10,
      thresholdValue: null,
      thresholdUnit: 'none',
      tariffId: null,
      requiredReviewerRole: 'admin',
      fourEyesRequired: true,
      validFrom: null,
      validUntil: null,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
      createdByUserId,
    },
    {
      id: PRODUCTION_APPROVAL_RULE_DISCOUNT_ABOVE_THRESHOLD_ID,
      schemaVersion: 1,
      name: 'Rabatt über Schwelle',
      description: 'Freigabe bei Rabatt über 10 %',
      type: 'discount_above_threshold',
      status: 'active',
      priority: 20,
      thresholdValue: 1000,
      thresholdUnit: 'percent_tenths',
      tariffId: null,
      requiredReviewerRole: 'admin',
      fourEyesRequired: true,
      validFrom: null,
      validUntil: null,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
      createdByUserId,
    },
    {
      id: PRODUCTION_APPROVAL_RULE_MISSING_REQUIRED_DATA_ID,
      schemaVersion: 1,
      name: 'Fehlende Pflichtdaten',
      description: 'Freigabe blockiert bei fehlenden Pflichtangaben',
      type: 'missing_required_data',
      status: 'active',
      priority: 5,
      thresholdValue: null,
      thresholdUnit: 'none',
      tariffId: null,
      requiredReviewerRole: 'admin',
      fourEyesRequired: false,
      validFrom: null,
      validUntil: null,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
      createdByUserId,
    },
  ];
}
