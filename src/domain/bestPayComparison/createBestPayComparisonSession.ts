import type {
  BestPayComparisonSession,
  BestPayManualInput,
} from './bestPayComparisonSession';
import {
  BESTPAY_COMPARISON_SCHEMA_VERSION,
  DEFAULT_BESTPAY_MANUAL_INPUT,
  DEFAULT_SALES_WIZARD_STATE,
} from './bestPayComparisonSession';
import { generateId, nowIso } from '../../utils/id';

export function createBestPayComparisonSession(
  userId: string,
  overrides: Partial<BestPayComparisonSession> = {},
): BestPayComparisonSession {
  const timestamp = nowIso();
  return {
    id: generateId('bestpay_comparison'),
    schemaVersion: BESTPAY_COMPARISON_SCHEMA_VERSION,
    status: 'draft',
    source: null,
    entryMode: 'calculator',
    title: null,
    leadId: null,
    customerLabel: null,
    leadDisplayName: null,
    billingImportSessionId: null,
    costBaselineId: null,
    costBaselineVersion: null,
    manualInput: { ...DEFAULT_BESTPAY_MANUAL_INPUT },
    result: null,
    selectedCandidateId: null,
    offerId: null,
    offerNumber: null,
    offerTitle: null,
    offerCreationToken: null,
    duplicateOfSessionId: null,
    wizard: {
      ...DEFAULT_SALES_WIZARD_STATE,
      prospectDraft: { ...DEFAULT_SALES_WIZARD_STATE.prospectDraft },
      scenarios: [],
    },
    createdByUserId: userId,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastOpenedAt: null,
    completedAt: null,
    archivedAt: null,
    discardedAt: null,
    ...overrides,
  };
}

export function mergeManualInput(
  current: BestPayManualInput,
  patch: Partial<BestPayManualInput>,
): BestPayManualInput {
  return {
    ...current,
    ...patch,
    paymentUsage: {
      ...current.paymentUsage,
      ...(patch.paymentUsage ?? {}),
    },
  };
}
