import { describe, expect, it } from 'vitest';
import {
  formatOfferDocumentNumber,
  getNextDocumentVersion,
  isValidOfferDocumentNumber,
  parseOfferDocumentVersion,
} from '../domain/offerDocument/offerDocumentNumber';
import type { OfferDocument } from '../domain/offerDocument/offerDocument';

describe('Offer document number', () => {
  it('formats document numbers as offer number plus version suffix', () => {
    expect(formatOfferDocumentNumber('BP-ANG-2026-0001', 1)).toBe('BP-ANG-2026-0001-V1');
    expect(formatOfferDocumentNumber('BP-ANG-2026-0042', 3)).toBe('BP-ANG-2026-0042-V3');
  });

  it('parses valid document version suffixes', () => {
    expect(parseOfferDocumentVersion('BP-ANG-2026-0001-V1')).toBe(1);
    expect(parseOfferDocumentVersion('BP-ANG-2026-0042-V12')).toBe(12);
    expect(parseOfferDocumentVersion('  BP-ANG-2026-0001-V2  ')).toBe(2);
  });

  it('rejects invalid document number formats', () => {
    expect(parseOfferDocumentVersion('BP-ANG-2026-0001')).toBeNull();
    expect(parseOfferDocumentVersion('BP-ANG-2026-0001-V0')).toBeNull();
    expect(parseOfferDocumentVersion('INVALID')).toBeNull();
    expect(parseOfferDocumentVersion('BP-ANG-2026-0001-v1')).toBeNull();
  });

  it('returns next version for empty document list', () => {
    expect(getNextDocumentVersion([])).toBe(1);
  });

  it('increments from highest existing version', () => {
    const documents = [
      { version: 1 },
      { version: 3 },
      { version: 2 },
    ] as OfferDocument[];

    expect(getNextDocumentVersion(documents)).toBe(4);
  });

  it('validates document number against offer number and version', () => {
    expect(isValidOfferDocumentNumber('BP-ANG-2026-0001-V1', 'BP-ANG-2026-0001', 1)).toBe(true);
    expect(isValidOfferDocumentNumber('BP-ANG-2026-0001-V2', 'BP-ANG-2026-0001', 1)).toBe(false);
    expect(isValidOfferDocumentNumber('BP-ANG-2026-0002-V1', 'BP-ANG-2026-0001', 1)).toBe(false);
  });
});
