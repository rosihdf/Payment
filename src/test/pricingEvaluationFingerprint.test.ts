import { describe, expect, it } from 'vitest';
import {
  createPricingEvaluationFingerprint,
  hasPricingRelevantInputChanged,
} from '../domain/pricingEngine/pricingEvaluationFingerprint';
import { createTestPricingInput } from './helpers/pricingTestHelpers';

describe('pricing evaluation fingerprint', () => {
  it('is deterministic for identical input', () => {
    const input = createTestPricingInput();
    expect(createPricingEvaluationFingerprint(input)).toBe(
      createPricingEvaluationFingerprint(input),
    );
  });

  it('changes when price changes', () => {
    const base = createTestPricingInput();
    const changed = createTestPricingInput({ requestedUnitPriceCents: 5000 });
    expect(hasPricingRelevantInputChanged(base, changed)).toBe(true);
  });

  it('does not change for equivalent normalized input', () => {
    const base = createTestPricingInput();
    const clone = createTestPricingInput({ ...base });
    expect(hasPricingRelevantInputChanged(base, clone)).toBe(false);
  });
});
