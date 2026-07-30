import {
  BESTPAY_A920_TARIFFS_RAW,
  DEMO_PLACEHOLDER_PRODUCT_CODES,
  DEMO_PLACEHOLDER_TARIFF_IDS,
} from '../domain/tariff/bestPayTariffs';
import { normalizeTariff, normalizeTariffs } from '../domain/tariff/normalizeTariff';
import type { Tariff } from '../domain/tariff/tariff';
import { isSameProductCode } from './tariffValidation';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_TARIFF_CATALOG_VERSION = 2;

function isDemoPlaceholderTariff(tariff: Tariff): boolean {
  return (
    DEMO_PLACEHOLDER_TARIFF_IDS.has(tariff.id) ||
    DEMO_PLACEHOLDER_PRODUCT_CODES.has(tariff.productCode.toUpperCase())
  );
}

function hasA920Tariff(tariffs: Tariff[], id: string, productCode: string): boolean {
  return tariffs.some(
    (tariff) => tariff.id === id || isSameProductCode(tariff.productCode, productCode),
  );
}

export function migrateTariffCatalogIfNeeded(): void {
  const currentVersion = readStorageItem<number>(STORAGE_KEYS.tariffCatalogVersion) ?? 0;

  if (currentVersion >= CURRENT_TARIFF_CATALOG_VERSION) {
    return;
  }

  const rawTariffs = readStorageItem<unknown[]>(STORAGE_KEYS.tariffs) ?? [];
  let tariffs = normalizeTariffs(rawTariffs).filter((tariff) => !isDemoPlaceholderTariff(tariff));

  for (const rawTariff of BESTPAY_A920_TARIFFS_RAW) {
    if (!hasA920Tariff(tariffs, rawTariff.id, rawTariff.productCode)) {
      tariffs.push(normalizeTariff(rawTariff));
    }
  }

  writeStorageItem(STORAGE_KEYS.tariffs, tariffs);
  writeStorageItem(STORAGE_KEYS.tariffCatalogVersion, CURRENT_TARIFF_CATALOG_VERSION);
}

export function resetTariffCatalogVersionForTests(): void {
  localStorage.removeItem(STORAGE_KEYS.tariffCatalogVersion);
}
