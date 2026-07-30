import { BESTPAY_PRODUCTS_RAW, BESTPAY_PRODUCT_IDS } from '../domain/product/bestPayProducts';
import { normalizeProduct, normalizeProducts } from '../domain/product/normalizeProduct';
import type { Product } from '../domain/product/product';
import { isSameInternalProductCode } from './productValidation';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_PRODUCT_CATALOG_VERSION = 1;

function hasCatalogProduct(products: Product[], id: string, internalProductCode: string): boolean {
  return products.some(
    (product) =>
      product.id === id || isSameInternalProductCode(product.internalProductCode, internalProductCode),
  );
}

export function migrateProductCatalogIfNeeded(): void {
  const currentVersion = readStorageItem<number>(STORAGE_KEYS.productCatalogVersion) ?? 0;

  if (currentVersion >= CURRENT_PRODUCT_CATALOG_VERSION) {
    return;
  }

  const rawProducts = readStorageItem<unknown[]>(STORAGE_KEYS.products) ?? [];
  const products = normalizeProducts(rawProducts);

  for (const rawProduct of BESTPAY_PRODUCTS_RAW) {
    if (!hasCatalogProduct(products, rawProduct.id, rawProduct.internalProductCode)) {
      products.push(normalizeProduct(rawProduct));
    }
  }

  writeStorageItem(STORAGE_KEYS.products, products);
  writeStorageItem(STORAGE_KEYS.productCatalogVersion, CURRENT_PRODUCT_CATALOG_VERSION);
}

export function resetProductCatalogVersionForTests(): void {
  localStorage.removeItem(STORAGE_KEYS.productCatalogVersion);
}

export function isBestPayCatalogProductId(id: string): boolean {
  return BESTPAY_PRODUCT_IDS.has(id);
}
