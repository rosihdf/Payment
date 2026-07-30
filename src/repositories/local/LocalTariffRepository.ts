import type { Tariff } from '../../domain/tariff/tariff';
import { normalizeTariff, normalizeTariffs } from '../../domain/tariff/normalizeTariff';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';
import { TariffNotFoundError } from '../errors/TariffNotFoundError';
import type { TariffRepository } from '../interfaces/TariffRepository';

export class LocalTariffRepository implements TariffRepository {
  async getAll(): Promise<Tariff[]> {
    const rawTariffs = readStorageItem<unknown[]>(STORAGE_KEYS.tariffs) ?? [];
    return normalizeTariffs(rawTariffs);
  }

  async getById(id: string): Promise<Tariff | null> {
    const tariffs = await this.getAll();
    return tariffs.find((tariff) => tariff.id === id) ?? null;
  }

  async count(): Promise<number> {
    const tariffs = await this.getAll();
    return tariffs.length;
  }

  async create(tariff: Tariff): Promise<Tariff> {
    const tariffs = await this.getAll();
    const normalizedTariff = normalizeTariff(tariff);
    writeStorageItem(STORAGE_KEYS.tariffs, [...tariffs, normalizedTariff]);
    return normalizedTariff;
  }

  async update(tariff: Tariff): Promise<Tariff> {
    const tariffs = await this.getAll();
    const index = tariffs.findIndex((item) => item.id === tariff.id);

    if (index === -1) {
      throw new TariffNotFoundError(tariff.id);
    }

    const normalizedTariff = normalizeTariff(tariff);
    const updatedTariffs = [...tariffs];
    updatedTariffs[index] = normalizedTariff;
    writeStorageItem(STORAGE_KEYS.tariffs, updatedTariffs);
    return normalizedTariff;
  }
}
