import { describe, expect, it } from 'vitest';
import { DEFAULT_CREATE_TARIFF_INPUT } from '../domain/tariff/defaults';
import { validateCreateTariffInput } from '../services/tariffValidation';
import { createValidTariffInput } from './helpers/tariffTestHelpers';

describe('Tariff validation', () => {
  it('requires mandatory fields', () => {
    const errors = validateCreateTariffInput(DEFAULT_CREATE_TARIFF_INPUT);

    expect(errors.name).toBeTruthy();
    expect(errors.productCode).toBeTruthy();
    expect(errors.supportedTerminalTypes).toBeTruthy();
  });

  it('requires at least one terminal type', () => {
    const errors = validateCreateTariffInput(
      createValidTariffInput({ supportedTerminalTypes: [] }),
    );

    expect(errors.supportedTerminalTypes).toBe('Bitte wählen Sie mindestens eine Einsatzart.');
  });

  it('rejects negative money values', () => {
    const errors = validateCreateTariffInput(
      createValidTariffInput({ monthlyBaseFeeCents: -1 }),
    );

    expect(errors.monthlyBaseFeeCents).toContain('negativ');
  });

  it('rejects negative integers', () => {
    const errors = validateCreateTariffInput(
      createValidTariffInput({ includedTransactions: -5 }),
    );

    expect(errors.includedTransactions).toContain('nicht negative');
  });

  it('rejects invalid date range', () => {
    const errors = validateCreateTariffInput(
      createValidTariffInput({
        validFrom: '2026-12-01',
        validUntil: '2026-01-01',
      }),
    );

    expect(errors.validUntil).toBe(
      'Das Gültigkeitsende darf nicht vor dem Gültigkeitsbeginn liegen.',
    );
  });

  it('accepts valid tariff input', () => {
    const errors = validateCreateTariffInput(createValidTariffInput());
    expect(Object.keys(errors)).toHaveLength(0);
  });
});
