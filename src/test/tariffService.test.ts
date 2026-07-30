import { beforeEach, describe, expect, it } from 'vitest';
import { LocalTariffRepository } from '../repositories/local/LocalTariffRepository';
import { TariffService } from '../services/tariffService';
import {
  clearDemoDataForTests,
  resetDemoDataForTests,
} from '../services/demoDataService';
import {
  createUniqueTariffInput,
  createValidTariffInput,
} from './helpers/tariffTestHelpers';

describe('TariffService', () => {
  let tariffService: TariffService;

  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    tariffService = new TariffService(new LocalTariffRepository());
  });

  it('allows admin to create tariff', async () => {
    const input = createUniqueTariffInput('ADMIN-CREATE');
    const result = await tariffService.createTariff(input, { role: 'admin' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tariff.productCode).toBe('BP-TEST-ADMIN-CREATE');
    }
  });

  it('forbids field service from creating tariff', async () => {
    const result = await tariffService.createTariff(createUniqueTariffInput('FS-CREATE'), {
      role: 'field_service',
    });

    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('allows admin to update tariff', async () => {
    const tariffs = await tariffService.getAllTariffs();
    const target = tariffs[0]!;

    const result = await tariffService.updateTariff(
      target.id,
      { ...createValidTariffInput({ productCode: target.productCode }), name: 'Neuer Name' },
      { role: 'admin' },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tariff.name).toBe('Neuer Name');
    }
  });

  it('forbids field service from updating tariff', async () => {
    const tariffs = await tariffService.getAllTariffs();
    const target = tariffs[0]!;

    const result = await tariffService.updateTariff(
      target.id,
      createValidTariffInput({ productCode: target.productCode }),
      { role: 'field_service' },
    );

    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('prevents duplicate product codes', async () => {
    const tariffs = await tariffService.getAllTariffs();
    const existingCode = tariffs[0]!.productCode;

    const result = await tariffService.createTariff(
      createValidTariffInput({ productCode: existingCode }),
      { role: 'admin' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok && 'errors' in result) {
      expect(result.errors.productCode).toBe('Dieser Produktcode wird bereits verwendet.');
    }
  });

  it('compares product codes case-insensitively', async () => {
    const tariffs = await tariffService.getAllTariffs();
    const existingCode = tariffs[0]!.productCode;

    const result = await tariffService.createTariff(
      createValidTariffInput({ productCode: existingCode.toLowerCase() }),
      { role: 'admin' },
    );

    expect(result.ok).toBe(false);
  });

  it('allows keeping own product code on update', async () => {
    const tariffs = await tariffService.getAllTariffs();
    const target = tariffs[0]!;

    const result = await tariffService.updateTariff(
      target.id,
      createValidTariffInput({
        productCode: target.productCode,
        name: 'Aktualisiert',
      }),
      { role: 'admin' },
    );

    expect(result.ok).toBe(true);
  });

  it('sets timestamps on create', async () => {
    const result = await tariffService.createTariff(createUniqueTariffInput('TS-CREATE'), {
      role: 'admin',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tariff.createdAt).toBeTruthy();
      expect(result.tariff.updatedAt).toBeTruthy();
      expect(result.tariff.createdAt).toBe(result.tariff.updatedAt);
    }
  });

  it('preserves createdAt on update', async () => {
    const tariffs = await tariffService.getAllTariffs();
    const target = tariffs[0]!;

    const result = await tariffService.updateTariff(
      target.id,
      createValidTariffInput({ productCode: target.productCode, name: 'Update TS' }),
      { role: 'admin' },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tariff.createdAt).toBe(target.createdAt);
      expect(result.tariff.updatedAt).not.toBe(target.updatedAt);
    }
  });

  it('deactivates tariff via setTariffStatus', async () => {
    const tariffs = await tariffService.getAllTariffs();
    const activeTariff = tariffs.find((tariff) => tariff.status === 'active')!;

    const result = await tariffService.setTariffStatus(activeTariff.id, 'inactive', {
      role: 'admin',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tariff.status).toBe('inactive');
    }
  });

  it('activates tariff via setTariffStatus', async () => {
    const tariffs = await tariffService.getAllTariffs();
    const inactiveTariff = tariffs.find((tariff) => tariff.status === 'inactive')!;

    const result = await tariffService.setTariffStatus(inactiveTariff.id, 'active', {
      role: 'admin',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tariff.status).toBe('active');
    }
  });
});
