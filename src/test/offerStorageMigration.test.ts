import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeOffers } from '../domain/offer/normalizeOffer';
import {
  CURRENT_OFFER_STORAGE_VERSION,
  migrateOfferStorageIfNeeded,
  resetOfferStorageVersionForTests,
} from '../services/offerStorageMigration';
import { clearDemoDataForTests, getDemoLeads, getDemoProducts, getDemoTariffs } from '../services/demoDataService';
import { createTestOffer } from './helpers/offerTestHelpers';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

describe('offer storage migration', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetOfferStorageVersionForTests();
  });

  it('normalizes existing legacy offers on migration', () => {
    writeStorageItem(STORAGE_KEYS.offers, [
      {
        id: 'offer_legacy',
        title: 'Legacy Angebot',
        status: 'draft',
        items: [{ name: 'Pos', quantity: 0, priceType: 'monthly', unitPriceCents: null }],
      },
    ]);
    writeStorageItem(STORAGE_KEYS.offerStorageVersion, 0);

    migrateOfferStorageIfNeeded();

    const offers = normalizeOffers(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.offers) ?? '[]') as unknown[],
    );

    expect(offers).toHaveLength(1);
    expect(offers[0]?.id).toBe('offer_legacy');
    expect(offers[0]?.items[0]?.quantity).toBe(1);
    expect(localStorage.getItem(STORAGE_KEYS.offerStorageVersion)).toBe(
      String(CURRENT_OFFER_STORAGE_VERSION),
    );
  });

  it('is idempotent when run twice', () => {
    writeStorageItem(STORAGE_KEYS.offers, [createTestOffer({ id: 'offer_stable' })]);
    writeStorageItem(STORAGE_KEYS.offerStorageVersion, 0);

    migrateOfferStorageIfNeeded();
    const first = localStorage.getItem(STORAGE_KEYS.offers);

    migrateOfferStorageIfNeeded();
    const second = localStorage.getItem(STORAGE_KEYS.offers);

    expect(first).toBe(second);
  });

  it('does not change tariffs, leads or products', () => {
    const tariffs = getDemoTariffs();
    const leads = getDemoLeads();
    const products = getDemoProducts();

    writeStorageItem(STORAGE_KEYS.tariffs, tariffs);
    writeStorageItem(STORAGE_KEYS.leads, leads);
    writeStorageItem(STORAGE_KEYS.products, products);
    writeStorageItem(STORAGE_KEYS.offers, []);
    writeStorageItem(STORAGE_KEYS.offerStorageVersion, 0);

    migrateOfferStorageIfNeeded();

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.tariffs) ?? '[]')).toEqual(tariffs);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.leads) ?? '[]')).toEqual(leads);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.products) ?? '[]')).toEqual(products);
  });
});
