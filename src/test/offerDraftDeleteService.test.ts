import { beforeEach, describe, expect, it } from 'vitest';
import { OfferService } from '../services/offerService';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
import { LocalTariffRepository } from '../repositories/local/LocalTariffRepository';
import { LocalProductRepository } from '../repositories/local/LocalProductRepository';
import { LocalContractRepository } from '../repositories/local/LocalContractRepository';
import { LocalOfferDocumentRepository } from '../repositories/local/LocalOfferDocumentRepository';
import { LocalOfferShareRepository } from '../repositories/local/LocalOfferShareRepository';
import { LocalCommissionCalculationRepository } from '../repositories/local/LocalCommissionCalculationRepository';
import { LocalActivationCaseRepository } from '../repositories/local/LocalActivationCaseRepository';
import {
  createTestOffer,
  setupOfferTestStorage,
} from './helpers/offerTestHelpers';

describe('OfferService draft delete', () => {
  beforeEach(() => {
    setupOfferTestStorage('user_004');
  });

  function createService() {
    const offerRepository = new LocalOfferRepository();
    const offerService = new OfferService(
      offerRepository,
      new LocalLeadRepository(),
      new LocalTariffRepository(),
      new LocalProductRepository(),
    );
    offerService.setDraftDeletionRepositories({
      contractRepository: new LocalContractRepository(),
      offerDocumentRepository: new LocalOfferDocumentRepository(),
      offerShareRepository: new LocalOfferShareRepository(),
      commissionCalculationRepository: new LocalCommissionCalculationRepository(),
      activationCaseRepository: new LocalActivationCaseRepository(),
    });
    return { offerService, offerRepository };
  }

  const adminContext = {
    userId: 'user_004',
    role: 'admin' as const,
    displayName: 'Admin',
  };

  const fieldContext = {
    userId: 'user_001',
    role: 'field_service' as const,
    displayName: 'Außendienst',
  };

  it('allows admin to delete pure draft', async () => {
    const { offerService, offerRepository } = createService();
    const offer = await offerRepository.create(createTestOffer({ createdByUserId: 'user_004' }));

    const permission = await offerService.canDeleteDraftOffer(offer.id, adminContext);
    expect(permission.allowed).toBe(true);

    const result = await offerService.deleteDraftOffer(offer.id, adminContext);
    expect(result.ok).toBe(true);
    expect(await offerRepository.getById(offer.id)).toBeNull();
  });

  it('blocks non-admin delete', async () => {
    const { offerService, offerRepository } = createService();
    const offer = await offerRepository.create(createTestOffer());

    const permission = await offerService.canDeleteDraftOffer(offer.id, fieldContext);
    expect(permission.allowed).toBe(false);
    if (!permission.allowed) {
      expect(permission.blocker).toBe('not_admin');
    }
  });

  it('blocks delete for sent offers', async () => {
    const { offerService, offerRepository } = createService();
    const offer = await offerRepository.create(
      createTestOffer({ workflowStatus: 'sent', createdByUserId: 'user_004' }),
    );

    const permission = await offerService.canDeleteDraftOffer(offer.id, adminContext);
    expect(permission.allowed).toBe(false);
    if (!permission.allowed) {
      expect(permission.blocker).toBe('workflow_not_draft');
    }
  });
});
