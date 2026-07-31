import { describe, expect, it } from 'vitest';
import { createBestPayComparisonSession } from '../domain/bestPayComparison/createBestPayComparisonSession';
import {
  deriveSalesPipelinePhase,
  type SalesPipelineFacts,
} from '../domain/salesWorkspace/salesPipeline';
import type { Lead } from '../domain/lead/lead';
import type { Offer } from '../domain/offer/offer';
import { EMPTY_OFFER_RECOMMENDATION_LINK } from '../domain/recommendation/recommendationRecord';

function baseLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead_1',
    companyName: 'Test GmbH',
    contactFirstName: 'A',
    contactLastName: 'B',
    phone: '1',
    email: 'a@b.de',
    street: '',
    postalCode: '',
    city: '',
    industry: '',
    currentProvider: '',
    monthlyCardTurnoverCents: null,
    monthlyTransactions: null,
    averageTransactionValueCents: null,
    currentTerminalCount: null,
    currentTerminalModels: '',
    paymentUsage: { stationary: false, mobile: true, ecommerce: false, softPos: false },
    cardMix: { girocardPercent: 100, debitPercent: 0, creditPercent: 0, otherPercent: 0 },
    currentContractEndDate: null,
    currentNoticePeriod: '',
    requiredTerminalCount: 1,
    interest: 'medium',
    notes: '',
    nextFollowUpAt: null,
    status: 'new',
    assignedSalesUserId: 'user_001',
    createdByUserId: 'user_001',
    syncState: 'synced',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function baseOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'offer_1',
    offerNumber: 'ANG-1',
    status: 'draft',
    workflowStatus: 'draft',
    currentVersionNumber: 0,
    currentVersionId: null,
    sourceComparisonSessionId: null,
    sourceScenarioId: null,
    leadId: 'lead_1',
    customerSnapshot: {
      leadId: 'lead_1',
      companyName: 'Test',
      contactFirstName: 'A',
      contactLastName: 'B',
      phone: '',
      email: '',
      street: '',
      postalCode: '',
      city: '',
      taxNumber: '',
      vatId: '',
    },
    tariffSnapshot: null,
    items: [],
    title: 'Angebot',
    introductionText: '',
    internalNotes: '',
    customerNotes: '',
    validUntil: null,
    createdByUserId: 'user_001',
    createdByDisplayName: 'Laura',
    completedAt: null,
    completedByUserId: null,
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: '',
    recommendationLink: { ...EMPTY_OFFER_RECOMMENDATION_LINK },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Offer;
}

function facts(partial: Partial<SalesPipelineFacts>): SalesPipelineFacts {
  return {
    lead: baseLead(),
    sessions: [],
    offers: [],
    tasks: [],
    activities: [],
    commissionCaseStatus: null,
    approvalRequired: false,
    approvalBlocked: false,
    ...partial,
  };
}

describe('B02 sales pipeline derivation', () => {
  it('leitet Neu für neuen Lead ohne Aktivität ab', () => {
    expect(deriveSalesPipelinePhase(facts({}))).toBe('new');
  });

  it('leitet Kontakt aus Leadstatus ab', () => {
    expect(deriveSalesPipelinePhase(facts({ lead: baseLead({ status: 'contacted' }) }))).toBe(
      'contact',
    );
  });

  it('leitet Abrechnung aus Billing-Session ab', () => {
    const session = createBestPayComparisonSession('user_001', {
      leadId: 'lead_1',
      billingImportSessionId: 'bill_1',
      status: 'billing_import',
    });
    expect(deriveSalesPipelinePhase(facts({ sessions: [session] }))).toBe('billing');
  });

  it('leitet Berechnung aus Session-Ergebnis ab', () => {
    const session = createBestPayComparisonSession('user_001', {
      leadId: 'lead_1',
      status: 'calculated',
      result: {
        recommendationRecordId: 'r',
        recommendationVersion: 1,
        primaryCandidateId: 'c',
        variants: [],
        currentMonthlyCostsCents: 100,
        currentAnnualCostsCents: 1200,
        inputFingerprint: 'fp',
        calculatedAt: '2026-01-01T00:00:00.000Z',
        stale: false,
        staleReasons: [],
      },
    });
    expect(deriveSalesPipelinePhase(facts({ sessions: [session] }))).toBe('calculation');
  });

  it('leitet Angebot und Freigabe aus Draft-Offer ab', () => {
    expect(deriveSalesPipelinePhase(facts({ offers: [baseOffer()] }))).toBe('offer');
    expect(
      deriveSalesPipelinePhase(facts({ offers: [baseOffer()], approvalRequired: true })),
    ).toBe('approval');
  });

  it('leitet Nachfassen aus Aktivität Angebot versendet ab', () => {
    expect(
      deriveSalesPipelinePhase(
        facts({
          offers: [baseOffer()],
          activities: [
            {
              id: 'a1',
              schemaVersion: 1,
              type: 'offer_sent',
              title: 'Versendet',
              description: '',
              occurredAt: '2026-01-02T00:00:00.000Z',
              createdByUserId: 'user_001',
              leadId: 'lead_1',
              comparisonSessionId: null,
              offerId: 'offer_1',
              contractId: null,
              contractVersionId: null,
              taskId: null,
              isSystem: true,
              editable: false,
              sourceKey: 'x',
              createdAt: '2026-01-02T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z',
            },
          ],
        }),
      ),
    ).toBe('follow_up');
  });

  it('leitet Angenommen / Aktivierung / Abgerechnet / Gewonnen ab', () => {
    expect(
      deriveSalesPipelinePhase(facts({ offers: [baseOffer({ status: 'completed' })] })),
    ).toBe('accepted');
    expect(
      deriveSalesPipelinePhase(
        facts({
          offers: [baseOffer({ status: 'completed' })],
          commissionCaseStatus: 'expected',
        }),
      ),
    ).toBe('activation');
    expect(
      deriveSalesPipelinePhase(
        facts({
          offers: [baseOffer({ status: 'completed' })],
          commissionCaseStatus: 'settled',
        }),
      ),
    ).toBe('accounted');
    expect(
      deriveSalesPipelinePhase(
        facts({
          lead: baseLead({ status: 'won' }),
          offers: [baseOffer({ status: 'completed' })],
          commissionCaseStatus: 'paid',
        }),
      ),
    ).toBe('won');
  });

  it('leitet Verloren aus Lead oder storniertem Angebot ab', () => {
    expect(deriveSalesPipelinePhase(facts({ lead: baseLead({ status: 'lost' }) }))).toBe('lost');
    expect(
      deriveSalesPipelinePhase(facts({ offers: [baseOffer({ status: 'cancelled' })] })),
    ).toBe('lost');
  });

  it('stuft nicht unter fortgeschrittenen Offerstatus zurück', () => {
    const phase = deriveSalesPipelinePhase(
      facts({
        lead: baseLead({ status: 'new' }),
        offers: [baseOffer({ status: 'completed' })],
      }),
    );
    expect(phase).toBe('accepted');
  });
});
