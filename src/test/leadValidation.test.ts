import { describe, expect, it } from 'vitest';
import { validateCardMix } from '../domain/lead/cardMixValidation';
import { DEFAULT_CREATE_LEAD_INPUT } from '../domain/lead/defaults';
import { validateCreateLeadInput } from '../services/leadValidation';
import { createValidLeadInput } from './helpers/leadTestHelpers';

describe('Lead validation', () => {
  it('recognizes required fields', () => {
    const errors = validateCreateLeadInput(DEFAULT_CREATE_LEAD_INPUT);

    expect(errors.companyName).toBeDefined();
    expect(errors.contactFirstName).toBeDefined();
    expect(errors.contactLastName).toBeDefined();
    expect(errors.phone).toBeDefined();
  });

  it('accepts a valid email address', () => {
    const errors = validateCreateLeadInput(
      createValidLeadInput({ email: 'kontakt@beispiel.de' }),
    );

    expect(errors.email).toBeUndefined();
  });

  it('rejects an invalid email address', () => {
    const errors = validateCreateLeadInput(createValidLeadInput({ email: 'ungueltig' }));

    expect(errors.email).toBeDefined();
  });

  it('accepts a valid five-digit postal code', () => {
    const errors = validateCreateLeadInput(createValidLeadInput({ postalCode: '50667' }));

    expect(errors.postalCode).toBeUndefined();
  });

  it('rejects an invalid postal code', () => {
    const errors = validateCreateLeadInput(createValidLeadInput({ postalCode: '5066' }));

    expect(errors.postalCode).toBeDefined();
  });

  it('accepts a card mix that sums to 100 percent', () => {
    const errors = validateCreateLeadInput(
      createValidLeadInput({
        cardMix: {
          girocardPercent: 40,
          debitPercent: 30,
          creditPercent: 20,
          otherPercent: 10,
        },
      }),
    );

    expect(errors.cardMix).toBeUndefined();
    expect(validateCardMix(createValidLeadInput().cardMix).isValid).toBe(true);
  });

  it('rejects a card mix that does not sum to 100 percent', () => {
    const cardMix = {
      girocardPercent: 40,
      debitPercent: 30,
      creditPercent: 10,
      otherPercent: 5,
    };
    const errors = validateCreateLeadInput(createValidLeadInput({ cardMix }));

    expect(errors.cardMix).toBeDefined();
    expect(validateCardMix(cardMix).isValid).toBe(false);
  });

  it('accepts a card mix of 0 / 0 / 0 / 0', () => {
    const errors = validateCreateLeadInput(createValidLeadInput());

    expect(errors.cardMix).toBeUndefined();
  });

  it('rejects negative numbers', () => {
    const errors = validateCreateLeadInput(
      createValidLeadInput({
        monthlyCardTurnoverCents: -100,
        monthlyTransactions: -1,
        currentTerminalCount: -2,
      }),
    );

    expect(errors.monthlyCardTurnoverCents).toBeDefined();
    expect(errors.monthlyTransactions).toBeDefined();
    expect(errors.currentTerminalCount).toBeDefined();
  });

  it('rejects required terminal counts below 1', () => {
    const errors = validateCreateLeadInput(createValidLeadInput({ requiredTerminalCount: 0 }));

    expect(errors.requiredTerminalCount).toBeDefined();
  });
});
