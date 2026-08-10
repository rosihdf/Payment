import { describe, expect, it } from 'vitest';
import { buildOfferFrozenCommissionDisplay } from '../domain/offer/offerFrozenCommissionDisplay';
import type { OfferCommercialSnapshot } from '../domain/offer/offerCommercialSnapshot';
import { OFFER_FROZEN_COMMISSION_SOURCE_LABEL } from '../domain/offer/offerDetailCopy';
import {
  getOfferPrimaryStatusLabel,
  OFFER_PRIMARY_STATUS_LABELS,
} from '../features/offer/offerWorkflowDisplay';

function buildMinimalFrozenSnapshot(
  commissionAmountCents: number,
): OfferCommercialSnapshot {
  return {
    schemaVersion: 1,
    status: 'frozen',
    frozenAt: '2026-08-01T10:00:00.000Z',
    identity: {
      tariffId: 'tariff_1',
      tariffName: 'BestPay Classic',
      tariffProductCode: 'classic',
      productId: null,
      productName: null,
      terminalModel: 'A920',
      deploymentMode: 'stationary_wifi',
      contractConfiguration: 'terminal_acq_long_term',
      contractTermMonths: 36,
      contractTermId: 'term_36',
      terminalCount: 1,
    },
    needSnapshot: {} as never,
    customerSnapshot: {} as never,
    commercialConfig: {} as never,
    projection: {} as never,
    commission: {
      commissionPlanKind: 'classic',
      contractConfiguration: 'terminal_acq_long_term',
      calculatedAt: '2026-08-01T10:00:00.000Z',
      ruleIds: ['rule_1'],
      baseCommissionAmountCents: commissionAmountCents,
      accessoryCommissionAmountCents: 5000,
      provisionalRecurringAmountCents: 0,
      confirmedRecurringAmountCents: 0,
      finalExpectedCommissionAmountCents: commissionAmountCents + 5000,
      currency: 'EUR',
      status: 'frozen',
      preview: {
        calculationId: 'calc_1',
        engineVersion: '1.0.0',
        calculatedAt: '2026-08-01T10:00:00.000Z',
        evaluationDate: '2026-08-01',
        offerId: 'offer_1',
        offerVersionKey: 'v1',
        pricingEvaluationRecordId: 'pe_1',
        pricingEvaluationId: 'pe_1',
        salesRepresentativeId: 'user_001',
        assignmentId: null,
        commissionPlanId: 'plan_1',
        commissionPlanVersionId: 'plan_v1',
        commissionPlanVersionNumber: 1,
        components: [],
        rejectedRules: [],
        baseCommissionAmountCents: commissionAmountCents,
        provisionalRecurringAmountCents: 0,
        confirmedRecurringAmountCents: 0,
        accessoryCommissionAmountCents: 5000,
        bonusAmountCents: 0,
        malusAmountCents: 0,
        originalCommissionAmountCents: commissionAmountCents,
        proposedReductionAmountCents: 0,
        approvedReductionAmountCents: 0,
        correctionAmountCents: 0,
        finalExpectedCommissionAmountCents: commissionAmountCents + 5000,
        currency: 'EUR',
        status: 'frozen',
        adminReviewRequired: false,
        reductionReviewRequired: false,
        canFreeze: true,
        calculationBlocked: false,
        requiredJustifications: [],
        findings: [],
        reductionDecision: null,
        snapshot: {} as never,
        stale: false,
      },
    },
    sources: {} as never,
    missingCommercialData: [],
  };
}

describe('Phase 4E – Offer Detail UX', () => {
  it('nutzt zentrale Statuslabels ohne Doppelbedeutung', () => {
    expect(getOfferPrimaryStatusLabel('approved')).toBe('Bereit zur Kundenvorlage');
    expect(getOfferPrimaryStatusLabel('ready_to_send')).toBe('Bereit zur Kundenvorlage');
    expect(getOfferPrimaryStatusLabel('sent')).toBe('Beim Kunden');
    expect(OFFER_PRIMARY_STATUS_LABELS.cancelled).not.toBe(OFFER_PRIMARY_STATUS_LABELS.declined);
  });

  it('zeigt eingefrorene Provision aus Commercial Snapshot', () => {
    const display = buildOfferFrozenCommissionDisplay(buildMinimalFrozenSnapshot(120_000));
    expect(display?.oneTimeCommissionAmountCents).toBe(120_000);
    expect(display?.finalExpectedCommissionAmountCents).toBe(125_000);
    expect(display?.sourceLabel).toBe(OFFER_FROZEN_COMMISSION_SOURCE_LABEL);
    expect(display?.contractConfigurationLabel).toContain('Terminal + ACQ');
  });

  it('liefert null wenn kein Commission-Snapshot vorhanden', () => {
    const snapshot = buildMinimalFrozenSnapshot(100_000);
    expect(buildOfferFrozenCommissionDisplay({ ...snapshot, commission: null })).toBeNull();
  });
});
