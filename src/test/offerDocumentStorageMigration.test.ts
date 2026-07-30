import { beforeEach, describe, expect, it } from 'vitest';
import {
  CURRENT_OFFER_DOCUMENT_STORAGE_VERSION,
  migrateOfferDocumentStorageIfNeeded,
  resetOfferDocumentStorageVersionForTests,
} from '../services/offerDocumentStorageMigration';
import { clearDemoDataForTests, getDemoLeads, getDemoProducts, getDemoTariffs } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { normalizeOfferDocuments } from '../domain/offerDocument/normalizeOfferDocument';
import {
  createTestOfferDocument,
  seedPremiumLineCompletedOffer,
  setupOfferDocumentTestStorage,
} from './helpers/offerDocumentTestHelpers';

describe('offer document storage migration', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetOfferDocumentStorageVersionForTests();
  });

  it('normalizes legacy documents on migration', async () => {
    setupOfferDocumentTestStorage();
    const offer = await seedPremiumLineCompletedOffer();

    writeStorageItem(STORAGE_KEYS.offerDocuments, [
      {
        id: 'offer_doc_legacy',
        offerId: offer.id,
        offerNumber: offer.offerNumber,
        documentNumber: `${offer.offerNumber}-V1`,
        version: 1,
        status: 'generated',
        snapshot: {
          title: 'Legacy Dokument',
          pdfData: 'should-be-removed',
        },
      },
    ]);
    writeStorageItem(STORAGE_KEYS.offerDocumentStorageVersion, 0);

    migrateOfferDocumentStorageIfNeeded();

    const documents = normalizeOfferDocuments(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.offerDocuments) ?? '[]') as unknown[],
    );

    expect(documents).toHaveLength(1);
    expect(documents[0]?.id).toBe('offer_doc_legacy');
    expect(documents[0]?.snapshot.title).toBe('Legacy Dokument');
    expect(localStorage.getItem(STORAGE_KEYS.offerDocumentStorageVersion)).toBe(
      String(CURRENT_OFFER_DOCUMENT_STORAGE_VERSION),
    );
  });

  it('is idempotent when run twice', async () => {
    setupOfferDocumentTestStorage();
    const offer = await seedPremiumLineCompletedOffer();
    const document = await createTestOfferDocument(offer, { id: 'offer_doc_stable' });

    writeStorageItem(STORAGE_KEYS.offerDocuments, [document]);
    writeStorageItem(STORAGE_KEYS.offerDocumentStorageVersion, 0);

    migrateOfferDocumentStorageIfNeeded();
    const first = localStorage.getItem(STORAGE_KEYS.offerDocuments);

    migrateOfferDocumentStorageIfNeeded();
    const second = localStorage.getItem(STORAGE_KEYS.offerDocuments);

    expect(first).toBe(second);
  });

  it('does not change tariffs, leads, products or offers', () => {
    const tariffs = getDemoTariffs();
    const leads = getDemoLeads();
    const products = getDemoProducts();

    writeStorageItem(STORAGE_KEYS.tariffs, tariffs);
    writeStorageItem(STORAGE_KEYS.leads, leads);
    writeStorageItem(STORAGE_KEYS.products, products);
    writeStorageItem(STORAGE_KEYS.offers, []);
    writeStorageItem(STORAGE_KEYS.offerDocuments, []);
    writeStorageItem(STORAGE_KEYS.offerDocumentStorageVersion, 0);

    migrateOfferDocumentStorageIfNeeded();

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.tariffs) ?? '[]')).toEqual(tariffs);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.leads) ?? '[]')).toEqual(leads);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.products) ?? '[]')).toEqual(products);
  });
});
