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
import { resetDemoDataForTests } from '../services/demoDataService';
import { seedTestRecommendationCatalog } from './helpers/recommendationTestHelpers';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

function createRecommendationService() {
  return new RecommendationService(
    new LocalRecommendationRepository(),
    new LocalOfferRepository(),
    new LocalLeadRepository(),
    new LocalTariffRepository(),
    new LocalProductRepository(),
    new LocalPricingCatalogRepository(),
    new LocalCommissionCatalogRepository(),
  );
}

describe('RecommendationService', () => {
  beforeEach(() => {
    resetDemoDataForTests();
    seedTestRecommendationCatalog();
  });

  it('verweigert Zugriff auf fremde Angebote für Außendienst', async () => {
    const offerService = new OfferService(
      new LocalOfferRepository(),
      new LocalLeadRepository(),
      new LocalTariffRepository(),
      new LocalProductRepository(),
    );

    const created = await offerService.createOffer(
      {
        leadId: 'lead_001',
        tariffId: 'tariff_bestpay_a920_classic',
        title: 'Test',
        introductionText: '',
        internalNotes: '',
        customerNotes: '',
        validUntil: null,
        items: [],
      },
      { userId: 'user_001', role: 'field_service', displayName: 'Laura Berger' },
    );

    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const service = createRecommendationService();
    const view = await service.getSalesViewForOffer(created.offer.id, {
      userId: 'user_002',
      role: 'field_service',
    });

    expect(view).toBeNull();
  });

  it('berechnet Empfehlung und verhindert stale Übernahme', async () => {
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
    const offerService = new OfferService(
      new LocalOfferRepository(),
      new LocalLeadRepository(),
      new LocalTariffRepository(),
      new LocalProductRepository(),
    );

    const created = await offerService.createOffer(
      {
        leadId: 'lead_001',
        tariffId: 'tariff_bestpay_a920_classic',
        title: 'Empfehlungstest',
        introductionText: '',
        internalNotes: '',
        customerNotes: '',
        validUntil: null,
        items: [],
      },
      { userId: 'user_001', role: 'field_service', displayName: 'Laura Berger' },
    );

    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const service = createRecommendationService();
    const context = { userId: 'user_001', role: 'field_service' as const };

    const calculated = await service.calculateForOffer(created.offer.id, context);
    expect(calculated.ok).toBe(true);

    const salesView = await service.getSalesViewForOffer(created.offer.id, context);
    expect(salesView?.primary).not.toBeNull();

    if (!salesView?.primary) {
      return;
    }

    const apply = await service.applyCandidateSelection(
      created.offer.id,
      salesView.primary.candidateId,
      context,
      { selectionType: 'primary' },
    );
    expect(apply.ok).toBe(true);
  });

  it('gibt Admin vollständige Kandidatenanalyse zurück', async () => {
    const offerService = new OfferService(
      new LocalOfferRepository(),
      new LocalLeadRepository(),
      new LocalTariffRepository(),
      new LocalProductRepository(),
    );

    const created = await offerService.createOffer(
      {
        leadId: 'lead_001',
        tariffId: 'tariff_bestpay_a920_classic',
        title: 'Admin Test',
        introductionText: '',
        internalNotes: '',
        customerNotes: '',
        validUntil: null,
        items: [],
      },
      { userId: 'user_001', role: 'field_service', displayName: 'Laura Berger' },
    );

    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const service = createRecommendationService();
    await service.calculateForOffer(created.offer.id, { userId: 'user_001', role: 'field_service' });

    const adminView = await service.getAdminViewForOffer(created.offer.id, {
      userId: 'user_004',
      role: 'admin',
    });

    expect(adminView).not.toBeNull();
    expect(adminView!.rankedCandidates.length).toBeGreaterThan(0);
    expect(adminView!.rankedCandidates[0]?.scoreBreakdown).not.toBeNull();
  });
});
