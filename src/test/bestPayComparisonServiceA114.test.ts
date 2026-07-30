import { beforeEach, describe, expect, it } from 'vitest';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import { LocalProductRepository } from '../repositories/local/LocalProductRepository';
import { LocalRecommendationRepository } from '../repositories/local/LocalRecommendationRepository';
import { LocalTariffRepository } from '../repositories/local/LocalTariffRepository';
import { LocalPricingCatalogRepository } from '../repositories/local/LocalPricingCatalogRepository';
import { LocalCommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import { RecommendationService } from '../services/recommendationService';
import { OfferService } from '../services/offerService';
import { BillingImportService } from '../services/billingImportService';
import { BestPayComparisonService } from '../services/bestPayComparisonService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { seedTestRecommendationCatalog } from './helpers/recommendationTestHelpers';
import { STORAGE_KEYS, readStorageItem, writeStorageItem } from '../utils/storage';

function createService() {
  const leadRepository = new LocalLeadRepository();
  const offerRepository = new LocalOfferRepository();
  const billingImportService = new BillingImportService(offerRepository);
  const recommendationService = new RecommendationService(
    new LocalRecommendationRepository(),
    offerRepository,
    leadRepository,
    new LocalTariffRepository(),
    new LocalProductRepository(),
    new LocalPricingCatalogRepository(),
    new LocalCommissionCatalogRepository(),
    billingImportService,
  );
  const offerService = new OfferService(
    offerRepository,
    leadRepository,
    new LocalTariffRepository(),
    new LocalProductRepository(),
  );
  return {
    service: new BestPayComparisonService(
      billingImportService,
      recommendationService,
      offerService,
      leadRepository,
      offerRepository,
    ),
    offerRepository,
  };
}

const context = { userId: 'user_001', role: 'field_service' as const, displayName: 'Laura Berger' };

describe('A11.4 BestPayComparisonService', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    seedTestRecommendationCatalog();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  it('legt Session an, speichert Entwurf und verwirft ihn', () => {
    const { service } = createService();
    const created = service.createSession(context);
    expect(created.status).toBe('draft');
    expect(created.schemaVersion).toBe(2);

    service.updateManualInput(
      created.id,
      { monthlyCardVolumeCents: 100_000_00, monthlyTotalCostsCents: 250_00 },
      context,
    );
    const draft = service.getActiveDraft(context);
    expect(draft?.id).toBe(created.id);

    expect(service.discardSession(created.id, context)).toBe(true);
    expect(service.getActiveDraft(context)).toBeNull();
  });

  it('blockiert Berechnung ohne Mindestdaten', async () => {
    const { service } = createService();
    const session = service.createSession(context);
    const result = await service.calculate(session.id, context);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('incomplete_input');
    }
  });

  it('berechnet über Recommendation-Engine und erlaubt Alternativenwahl', async () => {
    const { service } = createService();
    const session = service.createSession(context);
    service.updateManualInput(
      session.id,
      {
        monthlyCardVolumeCents: 5_000_000,
        monthlyTransactions: 1200,
        monthlyTotalCostsCents: 450_00,
        terminalCount: 2,
        paymentUsage: {
          stationary: false,
          mobile: true,
          ecommerce: false,
          softPos: false,
        },
      },
      context,
    );

    const calculated = await service.calculate(session.id, context);
    expect(calculated.ok).toBe(true);
    if (!calculated.ok) {
      return;
    }

    expect(calculated.session.status).toBe('calculated');
    expect(calculated.session.result?.variants.length).toBeGreaterThan(0);
    expect(calculated.session.result?.stale).toBe(false);

    const alternative = calculated.session.result!.variants[1];
    if (alternative) {
      const selected = service.selectVariant(session.id, alternative.candidateId, context);
      expect(selected?.selectedCandidateId).toBe(alternative.candidateId);
      expect(selected?.status).toBe('recommendation_selected');
    }
  });

  it('erzeugt Angebot idempotent und markiert Herkunft', async () => {
    const { service, offerRepository } = createService();
    const session = service.createSession(context);
    service.updateManualInput(
      session.id,
      {
        monthlyCardVolumeCents: 5_000_000,
        monthlyTransactions: 1200,
        monthlyTotalCostsCents: 450_00,
        terminalCount: 2,
      },
      context,
    );
    const calculated = await service.calculate(session.id, context);
    expect(calculated.ok).toBe(true);
    if (!calculated.ok) {
      return;
    }

    const assigned = await service.assignLead(session.id, 'lead_001', context);
    expect(assigned.ok).toBe(true);

    const first = await service.createOfferFromComparison(session.id, context, {
      creationToken: 'token_a114',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = await service.createOfferFromComparison(session.id, context, {
      creationToken: 'token_a114',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.offerId).toBe(first.offerId);

    const offer = await offerRepository.getById(first.offerId);
    expect(offer?.internalNotes).toContain('bestpay_calculator');
    expect(offer?.recommendationLink.recommendationRecordId).toBeTruthy();
  });

  it('blockiert Angebot bei stale Ergebnis', async () => {
    const { service } = createService();
    const session = service.createSession(context);
    service.updateManualInput(
      session.id,
      {
        monthlyCardVolumeCents: 5_000_000,
        monthlyTransactions: 1200,
        monthlyTotalCostsCents: 450_00,
      },
      context,
    );
    const calculated = await service.calculate(session.id, context);
    expect(calculated.ok).toBe(true);
    if (!calculated.ok) {
      return;
    }

    service.updateManualInput(session.id, { monthlyTotalCostsCents: 500_00 }, context);
    await service.assignLead(session.id, 'lead_001', context);

    const offer = await service.createOfferFromComparison(session.id, context);
    expect(offer.ok).toBe(false);
    if (!offer.ok) {
      expect(offer.error).toBe('stale');
    }
  });

  it('speichert keine Originaldateien in Comparison-Sessions', () => {
    const { service } = createService();
    service.createSession(context);
    const raw = JSON.stringify(readStorageItem(STORAGE_KEYS.bestPayComparisonSessions) ?? []);
    expect(raw).not.toMatch(/data:image|application\/pdf|base64,/i);
  });
});
