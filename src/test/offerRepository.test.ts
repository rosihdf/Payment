import { beforeEach, describe, expect, it } from 'vitest';
import { OfferConflictError } from '../repositories/errors/OfferConflictError';
import { OfferNotFoundError } from '../repositories/errors/OfferNotFoundError';
import { LocalOfferRepository } from '../repositories/local/LocalOfferRepository';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { createTestOffer } from './helpers/offerTestHelpers';

describe('LocalOfferRepository', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('creates an offer', async () => {
    const repository = new LocalOfferRepository();
    const offer = createTestOffer({ id: 'offer_new' });

    const created = await repository.create(offer);

    expect((await repository.getAll()).length).toBe(1);
    expect(created.id).toBe('offer_new');
    expect(await repository.getById('offer_new')).toEqual(created);
  });

  it('updates an existing offer', async () => {
    const repository = new LocalOfferRepository();
    const existing = createTestOffer({ id: 'offer_update' });
    await repository.create(existing);

    const updated = await repository.update({
      ...existing,
      title: 'Aktualisiertes Angebot',
      updatedAt: '2026-08-01T10:00:00.000Z',
    });

    expect(updated.title).toBe('Aktualisiertes Angebot');
    expect((await repository.getById('offer_update'))?.title).toBe('Aktualisiertes Angebot');
  });

  it('throws on update with unknown id', async () => {
    const repository = new LocalOfferRepository();
    const offer = createTestOffer({ id: 'offer_missing' });

    await expect(repository.update(offer)).rejects.toBeInstanceOf(OfferNotFoundError);
  });

  it('does not create a new offer on update', async () => {
    const repository = new LocalOfferRepository();
    const countBefore = (await repository.getAll()).length;
    const offer = createTestOffer({ id: 'offer_unknown' });

    await expect(repository.update(offer)).rejects.toThrow();
    expect((await repository.getAll()).length).toBe(countBefore);
  });

  it('returns null for unknown id', async () => {
    const repository = new LocalOfferRepository();

    expect(await repository.getById('offer_does_not_exist')).toBeNull();
  });

  it('returns defensive copies from create and update', async () => {
    const repository = new LocalOfferRepository();
    const offer = createTestOffer({ id: 'offer_copy_test', title: 'Original' });

    const created = await repository.create(offer);
    created.title = 'Mutiert';

    expect((await repository.getById('offer_copy_test'))?.title).toBe('Original');

    const existing = (await repository.getById('offer_copy_test'))!;
    const updated = await repository.update({ ...existing, title: 'Geändert' });
    updated.title = 'Erneut mutiert';

    expect((await repository.getById('offer_copy_test'))?.title).toBe('Geändert');
  });

  it('prevents duplicate offer ids', async () => {
    const repository = new LocalOfferRepository();
    const offer = createTestOffer({ id: 'offer_dup_id' });
    await repository.create(offer);

    await expect(repository.create(offer)).rejects.toBeInstanceOf(OfferConflictError);
  });

  it('prevents duplicate offer numbers', async () => {
    const repository = new LocalOfferRepository();
    await repository.create(createTestOffer({ id: 'offer_a', offerNumber: 'BP-ANG-2026-0001' }));

    await expect(
      repository.create(createTestOffer({ id: 'offer_b', offerNumber: 'BP-ANG-2026-0001' })),
    ).rejects.toBeInstanceOf(OfferConflictError);
  });
});
