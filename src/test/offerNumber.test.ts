import { describe, expect, it } from 'vitest';
import {
  formatOfferNumber,
  generateNextOfferNumber,
  isValidOfferNumberFormat,
  parseOfferNumberSequence,
} from '../domain/offer/offerNumber';
import { createTestOffer } from './helpers/offerTestHelpers';

describe('Offer number generation', () => {
  it('formats offer numbers as BP-ANG-YYYY-NNNN', () => {
    expect(formatOfferNumber(2026, 1)).toBe('BP-ANG-2026-0001');
    expect(formatOfferNumber(2026, 42)).toBe('BP-ANG-2026-0042');
    expect(formatOfferNumber(2027, 9999)).toBe('BP-ANG-2027-9999');
  });

  it('parses valid offer numbers', () => {
    expect(parseOfferNumberSequence('BP-ANG-2026-0001')).toEqual({ year: 2026, sequence: 1 });
    expect(parseOfferNumberSequence('  BP-ANG-2026-0042  ')).toEqual({ year: 2026, sequence: 42 });
  });

  it('rejects invalid offer number formats', () => {
    expect(parseOfferNumberSequence('ANG-2026-0001')).toBeNull();
    expect(parseOfferNumberSequence('BP-ANG-26-0001')).toBeNull();
    expect(parseOfferNumberSequence('BP-ANG-2026-0000')).toBeNull();
    expect(isValidOfferNumberFormat('BP-ANG-2026-0000')).toBe(false);
    expect(isValidOfferNumberFormat('BP-ANG-2026-0001')).toBe(true);
  });

  it('generates first number for empty year', () => {
    const next = generateNextOfferNumber([], '2026-07-30T12:00:00.000Z');
    expect(next).toBe('BP-ANG-2026-0001');
  });

  it('increments sequence within the same year', () => {
    const existing = [
      createTestOffer({ offerNumber: 'BP-ANG-2026-0001' }),
      createTestOffer({ offerNumber: 'BP-ANG-2026-0007' }),
    ];

    const next = generateNextOfferNumber(existing, '2026-08-01T10:00:00.000Z');
    expect(next).toBe('BP-ANG-2026-0008');
  });

  it('resets sequence on year rollover', () => {
    const existing = [
      createTestOffer({ offerNumber: 'BP-ANG-2025-0099' }),
      createTestOffer({ offerNumber: 'BP-ANG-2026-0003' }),
    ];

    const next = generateNextOfferNumber(existing, '2027-01-02T08:00:00.000Z');
    expect(next).toBe('BP-ANG-2027-0001');
  });

  it('ignores offer numbers from other years when incrementing', () => {
    const existing = [
      createTestOffer({ offerNumber: 'BP-ANG-2025-9999' }),
      createTestOffer({ offerNumber: 'BP-ANG-2026-0002' }),
    ];

    const next = generateNextOfferNumber(existing, '2026-07-30T12:00:00.000Z');
    expect(next).toBe('BP-ANG-2026-0003');
  });
});
