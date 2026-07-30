import { beforeEach, describe, expect, it } from 'vitest';
import { LocalLeadRepository } from '../repositories/local/LocalLeadRepository';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import { LocalProductRepository } from '../repositories/local/LocalProductRepository';
import { LocalTariffRepository } from '../repositories/local/LocalTariffRepository';
import { OfferService } from '../services/offerService';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import {
  ADMIN_CONTEXT,
  createOfferViaService,
  createProductOfferItemInput,
  createTariffOnlyOfferInput,
  createValidOfferInput,
  FIELD_SERVICE_CONTEXT,
  getDemoLead,
  getDemoProduct,
  OTHER_FIELD_SERVICE_CONTEXT,
  seedCompletedOffer,
} from './helpers/offerTestHelpers';

describe('OfferService', () => {
  let offerService: OfferService;

  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    offerService = new OfferService(
      new LocalOfferRepository(),
      new LocalLeadRepository(),
      new LocalTariffRepository(),
      new LocalProductRepository(),
    );
  });

  it('creates draft offer with generated offer number', async () => {
    const result = await offerService.createOffer(createValidOfferInput(), FIELD_SERVICE_CONTEXT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.offer.status).toBe('draft');
      expect(result.offer.offerNumber).toMatch(/^BP-ANG-2026-\d{4}$/);
      expect(result.offer.createdByUserId).toBe(FIELD_SERVICE_CONTEXT.userId);
    }
  });

  it('allows admin to see all offers', async () => {
    await createOfferViaService(offerService, createValidOfferInput(), FIELD_SERVICE_CONTEXT);
    await createOfferViaService(
      offerService,
      createValidOfferInput({ title: 'Admin Angebot', leadId: 'lead_002' }),
      OTHER_FIELD_SERVICE_CONTEXT,
    );

    const offers = await offerService.getOffers(ADMIN_CONTEXT);
    expect(offers.length).toBe(2);
  });

  it('limits field service to own offers only', async () => {
    await createOfferViaService(offerService, createValidOfferInput(), FIELD_SERVICE_CONTEXT);
    await createOfferViaService(
      offerService,
      createValidOfferInput({ title: 'Fremdes Angebot', leadId: 'lead_002' }),
      OTHER_FIELD_SERVICE_CONTEXT,
    );

    const offers = await offerService.getOffers(FIELD_SERVICE_CONTEXT);
    expect(offers.length).toBe(1);
    expect(offers[0]?.createdByUserId).toBe(FIELD_SERVICE_CONTEXT.userId);
  });

  it('updates draft offer for owner', async () => {
    const created = await createOfferViaService(offerService);

    const result = await offerService.updateOffer(
      created.id,
      createValidOfferInput({ title: 'Aktualisierter Titel' }),
      FIELD_SERVICE_CONTEXT,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.offer.title).toBe('Aktualisierter Titel');
      expect(result.offer.createdAt).toBe(created.createdAt);
      expect(result.offer.updatedAt).toBeTruthy();
    }
  });

  it('forbids foreign access to offer by id', async () => {
    const created = await createOfferViaService(
      offerService,
      createValidOfferInput({ leadId: 'lead_002' }),
      OTHER_FIELD_SERVICE_CONTEXT,
    );

    expect(await offerService.getOfferById(created.id, FIELD_SERVICE_CONTEXT)).toBeNull();

    const updateResult = await offerService.updateOffer(
      created.id,
      createValidOfferInput({ leadId: 'lead_002', title: 'Hack' }),
      FIELD_SERVICE_CONTEXT,
    );
    expect(updateResult).toEqual({ ok: false, error: 'forbidden' });
  });

  it('completes draft offer', async () => {
    const created = await createOfferViaService(offerService);

    const result = await offerService.completeOffer(created.id, FIELD_SERVICE_CONTEXT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.offer.status).toBe('completed');
      expect(result.offer.completedByUserId).toBe(FIELD_SERVICE_CONTEXT.userId);
      expect(result.offer.completedAt).toBeTruthy();
    }
  });

  it('cancels offer with reason', async () => {
    const created = await createOfferViaService(offerService);

    const result = await offerService.cancelOffer(
      created.id,
      'Kunde hat abgesagt',
      FIELD_SERVICE_CONTEXT,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.offer.status).toBe('cancelled');
      expect(result.offer.cancellationReason).toBe('Kunde hat abgesagt');
    }
  });

  it('duplicates completed offer as new draft', async () => {
    const completed = await seedCompletedOffer(offerService);

    const result = await offerService.duplicateOfferAsDraft(completed.id, FIELD_SERVICE_CONTEXT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.offer.id).not.toBe(completed.id);
      expect(result.offer.status).toBe('draft');
      expect(result.offer.offerNumber).not.toBe(completed.offerNumber);
      expect(result.offer.items).toHaveLength(completed.items.length);
    }
  });

  it('rejects duplicate product on create', async () => {
    const product = getDemoProduct();
    const result = await offerService.createOffer(
      createValidOfferInput({
        items: [createProductOfferItemInput(product), createProductOfferItemInput(product)],
      }),
      FIELD_SERVICE_CONTEXT,
    );

    expect(result.ok).toBe(false);
    if (!result.ok && 'errors' in result) {
      expect(result.errors.itemErrors?.[1]?.productId).toBe(
        'Dieses Produkt ist bereits im Angebot enthalten.',
      );
    }
  });

  it('forbids updating completed offer', async () => {
    const completed = await seedCompletedOffer(offerService);

    const result = await offerService.updateOffer(
      completed.id,
      createValidOfferInput({ title: 'Später ändern' }),
      FIELD_SERVICE_CONTEXT,
    );

    expect(result).toEqual({ ok: false, error: 'invalid_status' });
  });

  it('forbids completing draft owned by another user', async () => {
    const created = await createOfferViaService(
      offerService,
      createValidOfferInput({ leadId: 'lead_002' }),
      OTHER_FIELD_SERVICE_CONTEXT,
    );

    const result = await offerService.completeOffer(created.id, FIELD_SERVICE_CONTEXT);
    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('filters offers by search and status', async () => {
    const draft = await createOfferViaService(
      offerService,
      createValidOfferInput({ title: 'Suche Alpha' }),
      FIELD_SERVICE_CONTEXT,
    );
    await seedCompletedOffer(
      offerService,
      createValidOfferInput({ title: 'Suche Beta' }),
      FIELD_SERVICE_CONTEXT,
    );

    const offers = await offerService.getOffers(FIELD_SERVICE_CONTEXT);
    const bySearch = offerService.filterOffers(offers, { search: 'Alpha', status: 'all', owner: 'all' }, FIELD_SERVICE_CONTEXT);
    const byStatus = offerService.filterOffers(offers, { search: '', status: 'draft', owner: 'all' }, FIELD_SERVICE_CONTEXT);

    expect(bySearch.some((offer) => offer.id === draft.id)).toBe(true);
    expect(bySearch.some((offer) => offer.title === 'Suche Beta')).toBe(false);
    expect(byStatus.every((offer) => offer.status === 'draft')).toBe(true);
  });

  it('filters admin offers by owner mine', async () => {
    await createOfferViaService(offerService, createValidOfferInput(), FIELD_SERVICE_CONTEXT);
    await createOfferViaService(
      offerService,
      createValidOfferInput({ leadId: 'lead_002' }),
      OTHER_FIELD_SERVICE_CONTEXT,
    );

    const offers = await offerService.getOffers(ADMIN_CONTEXT);
    const mine = offerService.filterOffers(
      offers,
      { search: '', status: 'all', owner: 'mine' },
      ADMIN_CONTEXT,
    );

    expect(mine).toHaveLength(0);
  });

  it('returns offers for accessible lead only', async () => {
    const created = await createOfferViaService(offerService);
    const foreignLeadOffers = await offerService.getOffersForLead('lead_002', FIELD_SERVICE_CONTEXT);

    expect((await offerService.getOffersForLead(getDemoLead().id, FIELD_SERVICE_CONTEXT)).some(
      (offer) => offer.id === created.id,
    )).toBe(true);
    expect(foreignLeadOffers).toHaveLength(0);
  });

  it('accepts tariff-only offer without items', async () => {
    const result = await offerService.createOffer(createTariffOnlyOfferInput(), FIELD_SERVICE_CONTEXT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.offer.items).toHaveLength(0);
      expect(result.offer.tariffSnapshot?.tariffId).toBeTruthy();
    }
  });
});
