import { beforeEach, describe, expect, it } from 'vitest';
import { LocalCommissionCalculationRepository } from '../repositories/local/LocalCommissionCalculationRepository';
import { LocalCommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import { LocalPricingCatalogRepository } from '../repositories/local/LocalPricingCatalogRepository';
import { LocalPricingEvaluationRepository } from '../repositories/local/LocalPricingEvaluationRepository';
import { CommissionCalculationService } from '../services/commissionCalculationService';
import { PricingEvaluationService } from '../services/pricingEvaluationService';
import { seedDemoCommissionCatalog } from './helpers/commissionTestHelpers';
import {
  ADMIN_CONTEXT,
  FIELD_SERVICE_CONTEXT,
  OTHER_FIELD_SERVICE_CONTEXT,
  seedOfferInStorage,
  setupOfferTestStorage,
} from './helpers/offerTestHelpers';
import { seedTestPricingCatalog, TEST_CONTRACT_TERM_24_ID } from './helpers/pricingTestHelpers';
import { resetPricingCatalogVersionForTests } from '../services/pricingCatalogMigration';
import { resetPricingEvaluationStorageForTests } from '../services/pricingEvaluationStorageMigration';
import { resetCommissionCatalogForTests } from '../services/commissionCatalogMigration';
import { resetCommissionCalculationStorageForTests } from '../services/commissionCalculationStorageMigration';

describe('commission calculation service', () => {
  beforeEach(() => {
    setupOfferTestStorage();
    resetPricingCatalogVersionForTests();
    resetPricingEvaluationStorageForTests();
    resetCommissionCatalogForTests();
    resetCommissionCalculationStorageForTests();
    seedTestPricingCatalog();
    seedDemoCommissionCatalog('classic');
  });

  function createServices() {
    const offerRepository = new LocalOfferRepository();
    const pricingEvaluationService = new PricingEvaluationService(
      new LocalPricingCatalogRepository(),
      new LocalPricingEvaluationRepository(),
      offerRepository,
    );
    const commissionCalculationService = new CommissionCalculationService(
      new LocalCommissionCatalogRepository(),
      new LocalCommissionCalculationRepository(),
      offerRepository,
      new LocalPricingEvaluationRepository(),
    );
    return { offerRepository, pricingEvaluationService, commissionCalculationService };
  }

  it('requires current pricing evaluation', async () => {
    const { offerRepository, commissionCalculationService } = createServices();
    const offer = await seedOfferInStorage(offerRepository);
    const result = await commissionCalculationService.calculatePreviewForOffer(
      offer.id,
      FIELD_SERVICE_CONTEXT,
      'terminal_plus_acq',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('pricing_missing');
    }
  });

  it('calculates preview after pricing evaluation', async () => {
    const { offerRepository, pricingEvaluationService, commissionCalculationService } = createServices();
    const offer = await seedOfferInStorage(offerRepository);
    await pricingEvaluationService.evaluateOffer(offer.id, FIELD_SERVICE_CONTEXT, {
      contractTermId: TEST_CONTRACT_TERM_24_ID,
      requestedUnitPriceCents: 11000,
    });

    const result = await commissionCalculationService.calculatePreviewForOffer(
      offer.id,
      FIELD_SERVICE_CONTEXT,
      'terminal_only',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.result.baseCommissionAmountCents).toBe(20000);
    }
  });

  it('denies foreign offer access', async () => {
    const { offerRepository, commissionCalculationService } = createServices();
    const offer = await seedOfferInStorage(offerRepository, {
      createdByUserId: FIELD_SERVICE_CONTEXT.userId,
    });
    const result = await commissionCalculationService.calculatePreviewForOffer(
      offer.id,
      OTHER_FIELD_SERVICE_CONTEXT,
      'terminal_plus_acq',
    );
    expect(result.ok).toBe(false);
  });

  it('hides admin details from sales view', async () => {
    const { offerRepository, pricingEvaluationService, commissionCalculationService } = createServices();
    const offer = await seedOfferInStorage(offerRepository);
    await pricingEvaluationService.evaluateOffer(offer.id, FIELD_SERVICE_CONTEXT);
    await commissionCalculationService.calculatePreviewForOffer(
      offer.id,
      FIELD_SERVICE_CONTEXT,
      'terminal_only',
    );

    const salesView = await commissionCalculationService.getSalesViewForOffer(
      offer.id,
      FIELD_SERVICE_CONTEXT,
    );
    expect(salesView).not.toHaveProperty('components');
    expect(salesView).not.toHaveProperty('rejectedRules');
  });

  it('allows admin reduction within 50 percent limit', async () => {
    const { offerRepository, pricingEvaluationService, commissionCalculationService } = createServices();
    const offer = await seedOfferInStorage(offerRepository);
    await pricingEvaluationService.evaluateOffer(offer.id, FIELD_SERVICE_CONTEXT, {
      contractTermId: TEST_CONTRACT_TERM_24_ID,
      requestedUnitPriceCents: 10000,
    });
    const preview = await commissionCalculationService.calculatePreviewForOffer(
      offer.id,
      ADMIN_CONTEXT,
      'terminal_only',
    );
    expect(preview.ok).toBe(true);

    const rejected = await commissionCalculationService.saveReductionDecision(
      offer.id,
      ADMIN_CONTEXT,
      20000,
      'Zu hohe Kürzung',
    );
    expect(rejected.ok).toBe(false);

    const approved = await commissionCalculationService.saveReductionDecision(
      offer.id,
      ADMIN_CONTEXT,
      10000,
      'Angemessene Kürzung wegen Preisabweichung',
    );
    expect(approved.ok).toBe(true);
    if (approved.ok) {
      expect(approved.record.result.finalExpectedCommissionAmountCents).toBe(10000);
    }
  });
});
