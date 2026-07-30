import { describe, expect, it } from 'vitest';
import {
  dedupeFeatureStrings,
  normalizeCreateOfferInput,
  normalizeOffer,
  normalizeOffers,
  resolveItemOriginalPrice,
} from '../domain/offer/normalizeOffer';
import { createTestOffer } from './helpers/offerTestHelpers';

describe('Offer normalization', () => {
  it('loads legacy offer without crashing', () => {
    const normalized = normalizeOffer({
      id: 'offer_legacy',
      title: 'Legacy Angebot',
      status: 'draft',
    });

    expect(normalized.id).toBe('offer_legacy');
    expect(normalized.title).toBe('Legacy Angebot');
    expect(normalized.status).toBe('draft');
    expect(normalized.items).toEqual([]);
  });

  it('applies defaults for missing fields', () => {
    const normalized = normalizeOffer({ id: 'offer_min', title: 'Minimal' });

    expect(normalized.offerNumber).toBe('');
    expect(normalized.status).toBe('draft');
    expect(normalized.leadId).toBe('');
    expect(normalized.tariffSnapshot).toBeNull();
    expect(normalized.items).toEqual([]);
    expect(normalized.introductionText).toBe('');
    expect(normalized.internalNotes).toBe('');
    expect(normalized.customerNotes).toBe('');
    expect(normalized.validUntil).toBeNull();
    expect(normalized.cancellationReason).toBe('');
  });

  it('preserves existing values', () => {
    const normalized = normalizeOffer({
      id: 'offer_full',
      offerNumber: 'BP-ANG-2026-0042',
      status: 'completed',
      title: 'Vollständiges Angebot',
      introductionText: 'Einleitung',
      internalNotes: 'Intern',
      customerNotes: 'Kunde',
      validUntil: '2026-12-31',
      completedAt: '2026-08-01T10:00:00.000Z',
    });

    expect(normalized.offerNumber).toBe('BP-ANG-2026-0042');
    expect(normalized.status).toBe('completed');
    expect(normalized.introductionText).toBe('Einleitung');
    expect(normalized.validUntil).toBe('2026-12-31');
    expect(normalized.completedAt).toBe('2026-08-01T10:00:00.000Z');
  });

  it('normalizes item quantities to 1..999', () => {
    const normalized = normalizeOffer({
      id: 'offer_qty',
      title: 'Menge',
      items: [
        { name: 'Pos A', quantity: 0 },
        { name: 'Pos B', quantity: 1500 },
        { name: 'Pos C', quantity: 2.7 },
      ],
    });

    expect(normalized.items[0]?.quantity).toBe(1);
    expect(normalized.items[1]?.quantity).toBe(999);
    expect(normalized.items[2]?.quantity).toBe(3);
  });

  it('reindexes items and removes duplicate ids', () => {
    const normalized = normalizeOffer({
      id: 'offer_items',
      title: 'Positionen',
      items: [
        { id: 'item_dup', name: 'Z', sortOrder: 2 },
        { id: 'item_dup', name: 'A', sortOrder: 0 },
        { id: 'item_other', name: 'M', sortOrder: 1 },
      ],
    });

    expect(normalized.items).toHaveLength(3);
    expect(normalized.items.map((item) => item.sortOrder)).toEqual([0, 1, 2]);
    expect(new Set(normalized.items.map((item) => item.id)).size).toBe(3);
  });

  it('forces included price to zero and on_request price to null', () => {
    const included = normalizeOffer({
      id: 'offer_included',
      title: 'Inklusive',
      items: [{ name: 'Pos', priceType: 'included', unitPriceCents: 500 }],
    });
    const onRequest = normalizeOffer({
      id: 'offer_on_request',
      title: 'Auf Anfrage',
      items: [{ name: 'Pos', priceType: 'on_request', unitPriceCents: 500 }],
    });

    expect(included.items[0]?.unitPriceCents).toBe(0);
    expect(onRequest.items[0]?.unitPriceCents).toBeNull();
  });

  it('sets completedAt from updatedAt when missing for completed offers', () => {
    const normalized = normalizeOffer({
      id: 'offer_completed',
      title: 'Abgeschlossen',
      status: 'completed',
      updatedAt: '2026-08-01T10:00:00.000Z',
    });

    expect(normalized.completedAt).toBe('2026-08-01T10:00:00.000Z');
  });

  it('normalizes create offer input', () => {
    const normalized = normalizeCreateOfferInput({
      leadId: ' lead_001 ',
      tariffId: ' tariff_001 ',
      title: ' Titel ',
      items: [{ name: ' Pos ', quantity: 2, priceType: 'monthly', unitPriceCents: 1000 }],
    });

    expect(normalized.leadId).toBe('lead_001');
    expect(normalized.tariffId).toBe('tariff_001');
    expect(normalized.title).toBe('Titel');
    expect(normalized.items[0]?.quantity).toBe(2);
  });

  it('deduplicates feature strings case-insensitively', () => {
    expect(dedupeFeatureStrings(['TSE', 'tse', 'GoBD', ''])).toEqual(['TSE', 'GoBD']);
  });

  it('resolves original item price by type', () => {
    expect(resolveItemOriginalPrice('included', 999)).toBe(0);
    expect(resolveItemOriginalPrice('on_request', 999)).toBeNull();
    expect(resolveItemOriginalPrice('monthly', 1995)).toBe(1995);
  });

  it('normalizes offer arrays', () => {
    const offers = normalizeOffers([
      { id: 'offer_a', title: 'A' },
      { id: 'offer_b', title: 'B' },
    ]);

    expect(offers).toHaveLength(2);
    expect(offers[0]?.status).toBe('draft');
    expect(offers[1]?.status).toBe('draft');
  });

  it('creates defensive copies of nested snapshots', () => {
    const source = createTestOffer();
    const normalized = normalizeOffer(source);

    normalized.customerSnapshot.companyName = 'Mutiert';
    normalized.tariffSnapshot!.name = 'Mutiert';
    normalized.items[0]!.name = 'Mutiert';

    expect(source.customerSnapshot.companyName).not.toBe('Mutiert');
    expect(source.tariffSnapshot?.name).not.toBe('Mutiert');
    expect(source.items[0]?.name).not.toBe('Mutiert');
  });
});
