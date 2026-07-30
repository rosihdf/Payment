import type { Tariff } from '../../domain/tariff/tariff';

export interface TariffRepository {
  getAll(): Promise<Tariff[]>;
  getById(id: string): Promise<Tariff | null>;
  count(): Promise<number>;
  create(tariff: Tariff): Promise<Tariff>;
  update(tariff: Tariff): Promise<Tariff>;
}
