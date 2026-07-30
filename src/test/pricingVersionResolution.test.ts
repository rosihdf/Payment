import { describe, expect, it } from 'vitest';
import {
  createTestPriceBookVersion,
  seedTestPricingCatalog,
} from './helpers/pricingTestHelpers';
import {
  isPriceBookVersionValidOnDate,
  resolvePublishedPriceBookVersion,
} from '../domain/pricingEngine/versionResolution';

describe('price book version resolution', () => {
  it('selects exactly one published valid version', () => {
    seedTestPricingCatalog();
    const version = createTestPriceBookVersion();
    const result = resolvePublishedPriceBookVersion([version], '2026-06-15');
    expect(result.version?.id).toBe(version.id);
    expect(result.ambiguous).toBe(false);
  });

  it('returns null when no valid published version exists', () => {
    const draft = createTestPriceBookVersion({ status: 'draft' });
    const result = resolvePublishedPriceBookVersion([draft], '2026-06-15');
    expect(result.version).toBeNull();
  });

  it('does not use archived versions', () => {
    const archived = createTestPriceBookVersion({ status: 'archived' });
    const result = resolvePublishedPriceBookVersion([archived], '2026-06-15');
    expect(result.version).toBeNull();
  });

  it('does not use future versions', () => {
    const future = createTestPriceBookVersion({ validFrom: '2027-01-01' });
    const result = resolvePublishedPriceBookVersion([future], '2026-06-15');
    expect(result.version).toBeNull();
  });

  it('flags ambiguity for equal highest versions', () => {
    const first = createTestPriceBookVersion({ id: 'v1', versionNumber: 2 });
    const second = createTestPriceBookVersion({ id: 'v2', versionNumber: 2 });
    const result = resolvePublishedPriceBookVersion([first, second], '2026-06-15');
    expect(result.version).toBeNull();
    expect(result.ambiguous).toBe(true);
  });

  it('respects validity end date', () => {
    const expired = createTestPriceBookVersion({ validUntil: '2026-01-01' });
    expect(isPriceBookVersionValidOnDate(expired, '2026-06-15')).toBe(false);
  });
});
