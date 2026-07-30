import type {
  CreateTariffInput,
  Tariff,
  TariffStatus,
  TariffStatusFilter,
  TerminalTypeFilter,
} from '../domain/tariff/tariff';
import type { UserRole } from '../domain/user/user';
import { generateId, nowIso } from '../utils/id';
import type { TariffRepository } from '../repositories/interfaces/TariffRepository';
import { TariffNotFoundError } from '../repositories/errors/TariffNotFoundError';
import {
  isSameProductCode,
  normalizeProductCode,
  validateCreateTariffInput,
  type CreateTariffErrors,
} from './tariffValidation';

export type CreateTariffResult =
  | { ok: true; tariff: Tariff }
  | { ok: false; errors: CreateTariffErrors }
  | { ok: false; error: 'forbidden' }
  | { ok: false; error: 'storage' };

export type UpdateTariffResult =
  | { ok: true; tariff: Tariff }
  | { ok: false; errors: CreateTariffErrors }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'forbidden' }
  | { ok: false; error: 'storage' };

export type SetTariffStatusResult =
  | { ok: true; tariff: Tariff }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'forbidden' }
  | { ok: false; error: 'storage' };

export interface TariffAdminContext {
  role: UserRole;
}

export interface TariffFilterOptions {
  query?: string;
  status?: TariffStatusFilter;
  terminalType?: TerminalTypeFilter;
}

function mapInputToFields(input: CreateTariffInput) {
  return {
    name: input.name.trim(),
    providerName: input.providerName.trim(),
    productCode: normalizeProductCode(input.productCode),
    description: input.description.trim(),
    status: input.status,
    supportedTerminalTypes: [...input.supportedTerminalTypes],
    monthlyBaseFeeCents: input.monthlyBaseFeeCents,
    monthlyTerminalFeeCents: input.monthlyTerminalFeeCents,
    setupFeeCents: input.setupFeeCents,
    minimumMonthlyFeeCents: input.minimumMonthlyFeeCents,
    minimumContractMonths: input.minimumContractMonths,
    noticePeriodMonths: input.noticePeriodMonths,
    includedTransactions: input.includedTransactions,
    additionalTransactionFeeCents: input.additionalTransactionFeeCents,
    cardRates: {
      girocard: { ...input.cardRates.girocard },
      debit: { ...input.cardRates.debit },
      credit: { ...input.cardRates.credit },
      other: { ...input.cardRates.other },
    },
    billingInterval: input.billingInterval,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    notes: input.notes.trim(),
  };
}

export class TariffService {
  private readonly tariffRepository: TariffRepository;

  constructor(tariffRepository: TariffRepository) {
    this.tariffRepository = tariffRepository;
  }

  canManageTariffs(context: TariffAdminContext): boolean {
    return context.role === 'admin';
  }

  validateCreateTariffInput(input: CreateTariffInput): CreateTariffErrors {
    return validateCreateTariffInput(input);
  }

  async getAllTariffs(): Promise<Tariff[]> {
    return this.tariffRepository.getAll();
  }

  async getTariffById(id: string): Promise<Tariff | null> {
    return this.tariffRepository.getById(id);
  }

  async getActiveTariffs(): Promise<Tariff[]> {
    const tariffs = await this.tariffRepository.getAll();
    return tariffs.filter((tariff) => tariff.status === 'active');
  }

  async getTariffCount(): Promise<number> {
    return this.tariffRepository.count();
  }

  async isProductCodeTaken(productCode: string, excludeTariffId?: string): Promise<boolean> {
    const tariffs = await this.tariffRepository.getAll();
    return tariffs.some(
      (tariff) =>
        tariff.id !== excludeTariffId &&
        isSameProductCode(tariff.productCode, productCode),
    );
  }

  async filterTariffs(options: TariffFilterOptions = {}): Promise<Tariff[]> {
    const tariffs = await this.tariffRepository.getAll();
    const normalizedQuery = options.query?.trim().toLowerCase() ?? '';

    return tariffs.filter((tariff) => {
      if (options.status && options.status !== 'all' && tariff.status !== options.status) {
        return false;
      }

      if (
        options.terminalType &&
        options.terminalType !== 'all' &&
        !tariff.supportedTerminalTypes.includes(options.terminalType)
      ) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        tariff.name,
        tariff.productCode,
        tariff.providerName,
        tariff.description,
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }

  async createTariff(
    input: CreateTariffInput,
    context: TariffAdminContext,
  ): Promise<CreateTariffResult> {
    if (!this.canManageTariffs(context)) {
      return { ok: false, error: 'forbidden' };
    }

    const errors = validateCreateTariffInput(input);

    if (await this.isProductCodeTaken(input.productCode)) {
      errors.productCode = 'Dieser Produktcode wird bereits verwendet.';
    }

    if (Object.keys(errors).length > 0) {
      return { ok: false, errors };
    }

    const timestamp = nowIso();
    const tariff: Tariff = {
      id: generateId('tariff'),
      ...mapInputToFields(input),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      const createdTariff = await this.tariffRepository.create(tariff);
      return { ok: true, tariff: createdTariff };
    } catch {
      return { ok: false, error: 'storage' };
    }
  }

  async updateTariff(
    tariffId: string,
    input: CreateTariffInput,
    context: TariffAdminContext,
  ): Promise<UpdateTariffResult> {
    if (!this.canManageTariffs(context)) {
      return { ok: false, error: 'forbidden' };
    }

    const existing = await this.tariffRepository.getById(tariffId);

    if (!existing) {
      return { ok: false, error: 'not_found' };
    }

    const errors = validateCreateTariffInput(input);

    if (await this.isProductCodeTaken(input.productCode, tariffId)) {
      errors.productCode = 'Dieser Produktcode wird bereits verwendet.';
    }

    if (Object.keys(errors).length > 0) {
      return { ok: false, errors };
    }

    const updatedTariff: Tariff = {
      ...mapInputToFields(input),
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    };

    try {
      const tariff = await this.tariffRepository.update(updatedTariff);
      return { ok: true, tariff };
    } catch (error) {
      if (error instanceof TariffNotFoundError) {
        return { ok: false, error: 'not_found' };
      }

      return { ok: false, error: 'storage' };
    }
  }

  async setTariffStatus(
    tariffId: string,
    status: TariffStatus,
    context: TariffAdminContext,
  ): Promise<SetTariffStatusResult> {
    if (!this.canManageTariffs(context)) {
      return { ok: false, error: 'forbidden' };
    }

    const existing = await this.tariffRepository.getById(tariffId);

    if (!existing) {
      return { ok: false, error: 'not_found' };
    }

    try {
      const tariff = await this.tariffRepository.update({
        ...existing,
        status,
        updatedAt: nowIso(),
      });
      return { ok: true, tariff };
    } catch (error) {
      if (error instanceof TariffNotFoundError) {
        return { ok: false, error: 'not_found' };
      }

      return { ok: false, error: 'storage' };
    }
  }
}
