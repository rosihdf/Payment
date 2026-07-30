import { describe, expect, it } from 'vitest';
import { DEFAULT_CURRENT_PAYMENT_CONDITIONS } from '../domain/calculator/comparisonDefaults';
import {
  hasValidationErrors,
  validateCurrentPaymentConditions,
  validateTariffSelection,
} from '../services/paymentComparisonValidation';

describe('paymentComparisonValidation', () => {
  it('rejects zero terminal count', () => {
    const errors = validateCurrentPaymentConditions({
      ...DEFAULT_CURRENT_PAYMENT_CONDITIONS,
      terminalCount: 0,
    });

    expect(errors.terminalCount).toBeTruthy();
  });

  it('rejects negative terminal count', () => {
    const errors = validateCurrentPaymentConditions({
      ...DEFAULT_CURRENT_PAYMENT_CONDITIONS,
      terminalCount: -1,
    });

    expect(errors.terminalCount).toBeTruthy();
  });

  it('rejects decimal terminal count', () => {
    const errors = validateCurrentPaymentConditions({
      ...DEFAULT_CURRENT_PAYMENT_CONDITIONS,
      terminalCount: 1.5,
    });

    expect(errors.terminalCount).toBeTruthy();
  });

  it('rejects zero contract duration', () => {
    const errors = validateCurrentPaymentConditions({
      ...DEFAULT_CURRENT_PAYMENT_CONDITIONS,
      contractDurationYears: 0,
    });

    expect(errors.contractDurationYears).toBeTruthy();
  });

  it('rejects contract duration above 10 years', () => {
    const errors = validateCurrentPaymentConditions({
      ...DEFAULT_CURRENT_PAYMENT_CONDITIONS,
      contractDurationYears: 11,
    });

    expect(errors.contractDurationYears).toBeTruthy();
  });

  it('rejects negative fees', () => {
    const errors = validateCurrentPaymentConditions({
      ...DEFAULT_CURRENT_PAYMENT_CONDITIONS,
      terminalRentalPerUnitCents: -1,
    });

    expect(errors.terminalRentalPerUnitCents).toBeTruthy();
  });

  it('rejects negative volumes', () => {
    const errors = validateCurrentPaymentConditions({
      ...DEFAULT_CURRENT_PAYMENT_CONDITIONS,
      girocardVolumeMonthlyCents: -100,
    });

    expect(errors.girocardVolumeMonthlyCents).toBeTruthy();
  });

  it('rejects negative transaction counts', () => {
    const errors = validateCurrentPaymentConditions({
      ...DEFAULT_CURRENT_PAYMENT_CONDITIONS,
      acquiringTransactionCountMonthly: -1,
    });

    expect(errors.acquiringTransactionCountMonthly).toBeTruthy();
  });

  it('rejects decimal transaction counts', () => {
    const errors = validateCurrentPaymentConditions({
      ...DEFAULT_CURRENT_PAYMENT_CONDITIONS,
      girocardTransactionCountMonthly: 2.5,
    });

    expect(errors.girocardTransactionCountMonthly).toBeTruthy();
  });

  it('requires tariff selection', () => {
    const errors = validateTariffSelection(null, ['tariff_001']);
    expect(errors.tariffId).toBeTruthy();
  });

  it('rejects unknown tariff', () => {
    const errors = validateTariffSelection('missing', ['tariff_001']);
    expect(errors.tariffId).toBeTruthy();
  });

  it('accepts valid input', () => {
    const errors = validateCurrentPaymentConditions(DEFAULT_CURRENT_PAYMENT_CONDITIONS);
    expect(hasValidationErrors(errors)).toBe(false);
  });
});
