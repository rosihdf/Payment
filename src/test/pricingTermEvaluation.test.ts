import { describe, expect, it } from 'vitest';
import { PRICING_FINDING_CODES } from '../domain/pricing/pricingFinding';
import { evaluateContractTerm } from '../domain/pricingEngine/termEvaluation';
import {
  createTestContractTerm,
  createTestPricingInput,
  TEST_CONTRACT_TERM_24_ID,
} from './helpers/pricingTestHelpers';

describe('contract term evaluation', () => {
  it('accepts active standard term', () => {
    const result = evaluateContractTerm(
      createTestPricingInput({ contractTermId: TEST_CONTRACT_TERM_24_ID }),
      [createTestContractTerm()],
    );

    expect(result.isStandardTerm).toBe(true);
    expect(result.isSpecialTerm).toBe(false);
    expect(result.termMonths).toBe(24);
  });

  it('marks special term as critical finding', () => {
    const result = evaluateContractTerm(
      createTestPricingInput({
        contractTermId: null,
        requestedSpecialTermMonths: 18,
        specialTermReason: 'Kundenwunsch',
      }),
      [createTestContractTerm()],
    );

    expect(result.isSpecialTerm).toBe(true);
    expect(
      result.findings.some((finding) => finding.code === PRICING_FINDING_CODES.SPECIAL_TERM_REQUESTED),
    ).toBe(true);
  });

  it('requires reason for special term', () => {
    const result = evaluateContractTerm(
      createTestPricingInput({
        contractTermId: null,
        requestedSpecialTermMonths: 18,
        specialTermReason: '',
      }),
      [createTestContractTerm()],
    );

    expect(
      result.findings.some(
        (finding) => finding.code === PRICING_FINDING_CODES.SPECIAL_TERM_REASON_REQUIRED,
      ),
    ).toBe(true);
  });

  it('adds 36-month provision ambiguity hint', () => {
    const result = evaluateContractTerm(
      createTestPricingInput({
        contractTermId: null,
        requestedSpecialTermMonths: 36,
        specialTermReason: 'Langfristvertrag',
      }),
      [createTestContractTerm()],
    );

    expect(
      result.findings.some(
        (finding) => finding.code === PRICING_FINDING_CODES.PROVISION_TERM_AMBIGUOUS_36_MONTHS,
      ),
    ).toBe(true);
  });
});
