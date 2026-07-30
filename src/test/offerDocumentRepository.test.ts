import { beforeEach, describe, expect, it } from 'vitest';
import { OfferDocumentConflictError } from '../repositories/errors/OfferDocumentConflictError';
import { OfferDocumentNotFoundError } from '../repositories/errors/OfferDocumentNotFoundError';
import { LocalOfferDocumentRepository } from '../repositories/local/LocalOfferDocumentRepository';
import {
  createOfferServicesForTests,
  createTestOfferDocument,
  seedPremiumLineCompletedOffer,
  setupOfferDocumentTestStorage,
} from './helpers/offerDocumentTestHelpers';

describe('LocalOfferDocumentRepository', () => {
  beforeEach(() => {
    setupOfferDocumentTestStorage();
  });

  it('creates a document', async () => {
    const repository = new LocalOfferDocumentRepository();
    const offer = await seedPremiumLineCompletedOffer();
    const document = await createTestOfferDocument(offer, { id: 'offer_doc_new' });

    const created = await repository.create(document);

    expect((await repository.getAll()).length).toBe(1);
    expect(created.id).toBe('offer_doc_new');
    expect(await repository.getById('offer_doc_new')).toEqual(created);
  });

  it('returns documents by offer id sorted by version descending', async () => {
    const repository = new LocalOfferDocumentRepository();
    const offer = await seedPremiumLineCompletedOffer();
    await repository.create(await createTestOfferDocument(offer, { id: 'doc_v1', version: 1 }));
    await repository.create(
      await createTestOfferDocument(offer, {
        id: 'doc_v2',
        version: 2,
        status: 'superseded',
        documentNumber: `${offer.offerNumber}-V2`,
      }),
    );

    const documents = await repository.getByOfferId(offer.id);

    expect(documents).toHaveLength(2);
    expect(documents[0]?.version).toBe(2);
    expect(documents[1]?.version).toBe(1);
  });

  it('returns null for unknown id', async () => {
    const repository = new LocalOfferDocumentRepository();
    expect(await repository.getById('offer_doc_missing')).toBeNull();
  });

  it('returns defensive copies from create', async () => {
    const repository = new LocalOfferDocumentRepository();
    const offer = await seedPremiumLineCompletedOffer();
    const document = await createTestOfferDocument(offer, { id: 'offer_doc_copy' });

    const created = await repository.create(document);
    created.snapshot.title = 'Mutiert';

    expect((await repository.getById('offer_doc_copy'))?.snapshot.title).not.toBe('Mutiert');
  });

  it('marks document as superseded', async () => {
    const repository = new LocalOfferDocumentRepository();
    const offer = await seedPremiumLineCompletedOffer();
    const document = await repository.create(
      await createTestOfferDocument(offer, { id: 'offer_doc_supersede' }),
    );

    const updated = await repository.markSuperseded(document.id);

    expect(updated.status).toBe('superseded');
    expect((await repository.getById(document.id))?.status).toBe('superseded');
  });

  it('is idempotent when marking already superseded document', async () => {
    const repository = new LocalOfferDocumentRepository();
    const offer = await seedPremiumLineCompletedOffer();
    const document = await repository.create(
      await createTestOfferDocument(offer, {
        id: 'offer_doc_already_superseded',
        status: 'superseded',
      }),
    );

    const updated = await repository.markSuperseded(document.id);
    expect(updated.status).toBe('superseded');
  });

  it('throws when marking unknown document as superseded', async () => {
    const repository = new LocalOfferDocumentRepository();
    await expect(repository.markSuperseded('offer_doc_unknown')).rejects.toBeInstanceOf(
      OfferDocumentNotFoundError,
    );
  });

  it('prevents duplicate document ids', async () => {
    const repository = new LocalOfferDocumentRepository();
    const offer = await seedPremiumLineCompletedOffer();
    const document = await createTestOfferDocument(offer, { id: 'offer_doc_dup_id' });
    await repository.create(document);

    await expect(repository.create(document)).rejects.toBeInstanceOf(OfferDocumentConflictError);
  });

  it('prevents duplicate document numbers', async () => {
    const repository = new LocalOfferDocumentRepository();
    const offer = await seedPremiumLineCompletedOffer();
    await repository.create(await createTestOfferDocument(offer, { id: 'doc_a' }));

    await expect(
      repository.create(await createTestOfferDocument(offer, { id: 'doc_b', version: 1 })),
    ).rejects.toBeInstanceOf(OfferDocumentConflictError);
  });

  it('prevents duplicate version for same offer', async () => {
    const repository = new LocalOfferDocumentRepository();
    const offer = await seedPremiumLineCompletedOffer();
    await repository.create(await createTestOfferDocument(offer, { id: 'doc_v1', version: 1 }));

    await expect(
      repository.create(
        await createTestOfferDocument(offer, {
          id: 'doc_v1_dup',
          version: 1,
          documentNumber: `${offer.offerNumber}-V1`,
        }),
      ),
    ).rejects.toBeInstanceOf(OfferDocumentConflictError);
  });

  it('does not interfere with offer repository storage', async () => {
    const { offerRepository, offerDocumentRepository } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer();
    await offerDocumentRepository.create(await createTestOfferDocument(offer, { id: 'doc_isolated' }));

    expect((await offerRepository.getAll()).length).toBe(1);
    expect((await offerDocumentRepository.getAll()).length).toBe(1);
  });
});
