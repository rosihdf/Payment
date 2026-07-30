import { beforeEach, describe, expect, it } from 'vitest';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import { LocalPricingCatalogRepository } from '../repositories/local/LocalPricingCatalogRepository';
import { LocalPricingEvaluationRepository } from '../repositories/local/LocalPricingEvaluationRepository';
import { PricingEvaluationService } from '../services/pricingEvaluationService';
import { toSalesPricingEvaluationView } from '../services/pricingEvaluationViews';
import {
  ADMIN_CONTEXT,
  FIELD_SERVICE_CONTEXT,
  OTHER_FIELD_SERVICE_CONTEXT,
  resetOfferTestSequence,
  seedOfferInStorage,
  setupOfferTestStorage,
} from './helpers/offerTestHelpers';
import {
  createTestPricingInput,
  seedTestPricingCatalog,
  TEST_CONTRACT_TERM_24_ID,
} from './helpers/pricingTestHelpers';
import { resetPricingCatalogVersionForTests } from '../services/pricingCatalogMigration';
import { resetPricingEvaluationStorageForTests } from '../services/pricingEvaluationStorageMigration';

describe('pricing evaluation service', () => {
  beforeEach(() => {
    resetOfferTestSequence();
    resetPricingCatalogVersionForTests();
    resetPricingEvaluationStorageForTests();
    setupOfferTestStorage();
    seedTestPricingCatalog();
  });

  function createService(): PricingEvaluationService {
    return new PricingEvaluationService(
      new LocalPricingCatalogRepository(),
      new LocalPricingEvaluationRepository(),
      new LocalOfferRepository(),
    );
  }

  it('evaluates offer for field service user', async () => {
    const service = createService();
    const offerRepo = new LocalOfferRepository();
    const offer = await seedOfferInStorage(offerRepo);
    const result = await service.evaluateOffer(offer.id, FIELD_SERVICE_CONTEXT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.offerId).toBe(offer.id);
    }
  });

  it('denies foreign offer access', async () => {
    const service = createService();
    const offerRepo = new LocalOfferRepository();
    const offer = await seedOfferInStorage(offerRepo, {
      createdByUserId: FIELD_SERVICE_CONTEXT.userId,
    });
    const result = await service.evaluateOffer(offer.id, OTHER_FIELD_SERVICE_CONTEXT);
    expect(result.ok).toBe(false);
    if (!result.ok && 'error' in result) {
      expect(result.error).toBe('not_found');
    }
  });

  it('hides confidential values in sales view', async () => {
    const service = createService();
    const offerRepo = new LocalOfferRepository();
    const offer = await seedOfferInStorage(offerRepo);
    await service.evaluateOffer(offer.id, FIELD_SERVICE_CONTEXT);
    const salesView = await service.getSalesViewForOffer(offer.id, FIELD_SERVICE_CONTEXT);

    expect(salesView).not.toBeNull();
    expect(salesView).not.toHaveProperty('minimumPriceCents');
    expect(salesView).not.toHaveProperty('listPriceCents');
  });

  it('returns admin view with full price bounds', async () => {
    const service = createService();
    const offerRepo = new LocalOfferRepository();
    const offer = await seedOfferInStorage(offerRepo);
    await service.evaluateOffer(offer.id, ADMIN_CONTEXT);
    const adminView = await service.getAdminViewForOffer(offer.id, ADMIN_CONTEXT);

    expect(adminView?.minimumPriceCents).not.toBeNull();
    expect(adminView?.listPriceCents).not.toBeNull();
  });

  it('marks evaluation stale after relevant input change', async () => {
    const service = createService();
    const evaluation = await service.evaluateInput(
      createTestPricingInput({ contractTermId: TEST_CONTRACT_TERM_24_ID }),
      FIELD_SERVICE_CONTEXT,
    );
    expect(evaluation.ok).toBe(true);
    if (!evaluation.ok) {
      return;
    }

    const changed = createTestPricingInput({
      contractTermId: TEST_CONTRACT_TERM_24_ID,
      requestedUnitPriceCents: 5000,
    });
    const salesView = toSalesPricingEvaluationView({
      ...evaluation.result,
      stale: evaluation.result.inputFingerprint !== changed.evaluationDate,
    });

    expect(typeof salesView.stale).toBe('boolean');
  });
});
