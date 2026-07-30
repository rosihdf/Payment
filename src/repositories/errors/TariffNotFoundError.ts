export class TariffNotFoundError extends Error {
  readonly tariffId: string;

  constructor(tariffId: string) {
    super(`Tariff with id "${tariffId}" was not found.`);
    this.name = 'TariffNotFoundError';
    this.tariffId = tariffId;
  }
}
