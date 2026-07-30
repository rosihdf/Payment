import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeTariffs } from '../domain/tariff/normalizeTariff';
import { BESTPAY_A920_TARIFFS_RAW } from '../domain/tariff/bestPayTariffs';
import {
  CURRENT_TARIFF_CATALOG_VERSION,
  migrateTariffCatalogIfNeeded,
  resetTariffCatalogVersionForTests,
} from '../services/tariffCatalogMigration';
import { createTariffWithId } from './helpers/tariffTestHelpers';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { clearDemoDataForTests } from '../services/demoDataService';

describe('tariff catalog migration', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetTariffCatalogVersionForTests();
  });

  it('seeds fresh installation with A920 tariffs only', () => {
    writeStorageItem(STORAGE_KEYS.tariffs, normalizeTariffs([...BESTPAY_A920_TARIFFS_RAW]));
    writeStorageItem(STORAGE_KEYS.tariffCatalogVersion, CURRENT_TARIFF_CATALOG_VERSION);

    migrateTariffCatalogIfNeeded();

    const tariffs = JSON.parse(localStorage.getItem(STORAGE_KEYS.tariffs) ?? '[]') as unknown[];
    expect(tariffs).toHaveLength(2);
  });

  it('removes legacy demo tariffs and inserts A920 tariffs', () => {
    writeStorageItem(
      STORAGE_KEYS.tariffs,
      normalizeTariffs([
        {
          id: 'tariff_001',
          name: 'BestPay Start',
          productCode: 'BP-START',
          status: 'active',
          supportedTerminalTypes: ['stationary'],
        },
        {
          id: 'tariff_002',
          name: 'BestPay Business',
          productCode: 'BP-BUSINESS',
          status: 'active',
          supportedTerminalTypes: ['mobile'],
        },
        {
          id: 'tariff_003',
          name: 'BestPay Flex',
          productCode: 'BP-FLEX',
          status: 'inactive',
          supportedTerminalTypes: ['softpos'],
        },
      ]),
    );

    migrateTariffCatalogIfNeeded();

    const tariffs = normalizeTariffs(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.tariffs) ?? '[]') as unknown[],
    );

    expect(tariffs.some((tariff) => tariff.productCode === 'BP-START')).toBe(false);
    expect(tariffs.some((tariff) => tariff.id === 'tariff_bestpay_a920_classic')).toBe(true);
    expect(tariffs.some((tariff) => tariff.id === 'tariff_bestpay_a920_flat')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.tariffCatalogVersion)).toBe('2');
  });

  it('keeps custom admin tariffs', () => {
    const customTariff = createTariffWithId('tariff_custom_admin', {
      productCode: 'BP-CUSTOM-001',
      name: 'Eigener Admin Tarif',
    });

    writeStorageItem(
      STORAGE_KEYS.tariffs,
      normalizeTariffs([
        {
          id: 'tariff_001',
          name: 'BestPay Start',
          productCode: 'BP-START',
          status: 'active',
          supportedTerminalTypes: ['stationary'],
        },
        customTariff,
      ]),
    );

    migrateTariffCatalogIfNeeded();

    const tariffs = normalizeTariffs(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.tariffs) ?? '[]') as unknown[],
    );

    expect(tariffs.some((tariff) => tariff.id === 'tariff_custom_admin')).toBe(true);
    expect(tariffs.some((tariff) => tariff.name === 'Eigener Admin Tarif')).toBe(true);
  });

  it('does not duplicate existing A920 tariffs', () => {
    writeStorageItem(STORAGE_KEYS.tariffs, normalizeTariffs([...BESTPAY_A920_TARIFFS_RAW]));

    migrateTariffCatalogIfNeeded();
    migrateTariffCatalogIfNeeded();

    const tariffs = normalizeTariffs(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.tariffs) ?? '[]') as unknown[],
    );

    expect(tariffs.filter((tariff) => tariff.id === 'tariff_bestpay_a920_classic')).toHaveLength(1);
    expect(tariffs.filter((tariff) => tariff.id === 'tariff_bestpay_a920_flat')).toHaveLength(1);
  });

  it('is idempotent when run twice', () => {
    writeStorageItem(
      STORAGE_KEYS.tariffs,
      normalizeTariffs([
        {
          id: 'tariff_001',
          name: 'BestPay Start',
          productCode: 'BP-START',
          status: 'active',
          supportedTerminalTypes: ['stationary'],
        },
      ]),
    );

    migrateTariffCatalogIfNeeded();
    const first = localStorage.getItem(STORAGE_KEYS.tariffs);

    migrateTariffCatalogIfNeeded();
    const second = localStorage.getItem(STORAGE_KEYS.tariffs);

    expect(first).toBe(second);
  });
});
