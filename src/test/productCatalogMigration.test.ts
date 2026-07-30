import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeProducts } from '../domain/product/normalizeProduct';
import { BESTPAY_PRODUCTS_RAW } from '../domain/product/bestPayProducts';
import {
  CURRENT_PRODUCT_CATALOG_VERSION,
  migrateProductCatalogIfNeeded,
  resetProductCatalogVersionForTests,
} from '../services/productCatalogMigration';
import { clearDemoDataForTests, getDemoLeads, getDemoTariffs } from '../services/demoDataService';
import { createProductWithId } from './helpers/productTestHelpers';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

describe('product catalog migration', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetProductCatalogVersionForTests();
  });

  it('seeds fresh installation with all catalog products', () => {
    writeStorageItem(STORAGE_KEYS.products, []);
    writeStorageItem(STORAGE_KEYS.productCatalogVersion, 0);

    migrateProductCatalogIfNeeded();

    const products = normalizeProducts(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.products) ?? '[]') as unknown[],
    );

    expect(products).toHaveLength(BESTPAY_PRODUCTS_RAW.length);
    expect(products.some((product) => product.id === 'product_bestpay_premium_line_register')).toBe(
      true,
    );
    expect(localStorage.getItem(STORAGE_KEYS.productCatalogVersion)).toBe(
      String(CURRENT_PRODUCT_CATALOG_VERSION),
    );
  });

  it('adds missing catalog products to existing storage', () => {
    writeStorageItem(
      STORAGE_KEYS.products,
      normalizeProducts([
        {
          id: 'product_legacy_custom',
          name: 'Legacy Produkt',
          internalProductCode: 'BP-LEGACY-001',
          status: 'active',
        },
      ]),
    );

    migrateProductCatalogIfNeeded();

    const products = normalizeProducts(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.products) ?? '[]') as unknown[],
    );

    expect(products.some((product) => product.id === 'product_legacy_custom')).toBe(true);
    expect(products.some((product) => product.id === 'product_bestpay_premium_line_register')).toBe(
      true,
    );
    expect(products.length).toBe(BESTPAY_PRODUCTS_RAW.length + 1);
  });

  it('keeps custom admin products', () => {
    const customProduct = createProductWithId('product_custom_admin', {
      internalProductCode: 'BP-CUSTOM-001',
      name: 'Eigener Admin Produkt',
    });

    writeStorageItem(STORAGE_KEYS.products, normalizeProducts([customProduct]));

    migrateProductCatalogIfNeeded();

    const products = normalizeProducts(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.products) ?? '[]') as unknown[],
    );

    expect(products.some((product) => product.id === 'product_custom_admin')).toBe(true);
    expect(products.some((product) => product.name === 'Eigener Admin Produkt')).toBe(true);
  });

  it('does not duplicate existing catalog products', () => {
    writeStorageItem(STORAGE_KEYS.products, normalizeProducts([...BESTPAY_PRODUCTS_RAW]));

    migrateProductCatalogIfNeeded();
    migrateProductCatalogIfNeeded();

    const products = normalizeProducts(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.products) ?? '[]') as unknown[],
    );

    expect(
      products.filter((product) => product.id === 'product_bestpay_premium_line_register'),
    ).toHaveLength(1);
    expect(products.filter((product) => product.internalProductCode === 'BP-A920-SIM')).toHaveLength(
      1,
    );
  });

  it('is idempotent when run twice', () => {
    writeStorageItem(
      STORAGE_KEYS.products,
      normalizeProducts([
        {
          id: 'product_legacy_custom',
          name: 'Legacy Produkt',
          internalProductCode: 'BP-LEGACY-001',
          status: 'active',
        },
      ]),
    );

    migrateProductCatalogIfNeeded();
    const first = localStorage.getItem(STORAGE_KEYS.products);

    migrateProductCatalogIfNeeded();
    const second = localStorage.getItem(STORAGE_KEYS.products);

    expect(first).toBe(second);
  });

  it('does not change tariffs or leads', () => {
    const tariffs = getDemoTariffs();
    const leads = getDemoLeads();

    writeStorageItem(STORAGE_KEYS.tariffs, tariffs);
    writeStorageItem(STORAGE_KEYS.leads, leads);
    writeStorageItem(STORAGE_KEYS.products, []);

    migrateProductCatalogIfNeeded();

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.tariffs) ?? '[]')).toEqual(tariffs);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.leads) ?? '[]')).toEqual(leads);
  });
});
