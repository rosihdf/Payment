import { beforeEach, describe, expect, it } from 'vitest';
import { LocalTariffRepository } from '../repositories/local/LocalTariffRepository';
import { TariffNotFoundError } from '../repositories/errors/TariffNotFoundError';
import {
  clearDemoDataForTests,
  getDemoTariffs,
  resetDemoDataForTests,
} from '../services/demoDataService';
import { createTestTariff } from './helpers/tariffTestHelpers';

describe('LocalTariffRepository', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('creates a tariff', async () => {
    const repository = new LocalTariffRepository();
    const initialCount = await repository.count();
    const tariff = createTestTariff({ id: 'tariff_new' });

    const created = await repository.create(tariff);

    expect(await repository.count()).toBe(initialCount + 1);
    expect(created.id).toBe('tariff_new');
    expect(await repository.getById('tariff_new')).toEqual(created);
  });

  it('updates an existing tariff', async () => {
    const repository = new LocalTariffRepository();
    const existing = (await repository.getAll())[0]!;

    const updated = await repository.update({
      ...existing,
      name: 'Aktualisierter Tarif',
      updatedAt: '2026-08-01T10:00:00.000Z',
    });

    expect(updated.name).toBe('Aktualisierter Tarif');
    expect((await repository.getById(existing.id))?.name).toBe('Aktualisierter Tarif');
  });

  it('throws on update with unknown id', async () => {
    const repository = new LocalTariffRepository();
    const tariff = createTestTariff({ id: 'tariff_missing' });

    await expect(repository.update(tariff)).rejects.toBeInstanceOf(TariffNotFoundError);
  });

  it('does not create a new tariff on update', async () => {
    const repository = new LocalTariffRepository();
    const countBefore = await repository.count();
    const tariff = createTestTariff({ id: 'tariff_unknown' });

    await expect(repository.update(tariff)).rejects.toThrow();
    expect(await repository.count()).toBe(countBefore);
  });

  it('leaves other tariffs unchanged on update', async () => {
    const repository = new LocalTariffRepository();
    const tariffs = await repository.getAll();
    const target = tariffs[0]!;
    const untouched = tariffs[1]!;

    await repository.update({ ...target, name: 'Geändert' });

    expect((await repository.getById(untouched.id))?.name).toBe(untouched.name);
  });

  it('keeps deactivated tariff stored', async () => {
    const repository = new LocalTariffRepository();
    const existing = (await repository.getAll())[0]!;

    await repository.update({ ...existing, status: 'inactive' });

    const stored = await repository.getById(existing.id);
    expect(stored?.status).toBe('inactive');
    expect(await repository.count()).toBe(getDemoTariffs().length);
  });
});
