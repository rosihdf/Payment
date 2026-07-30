import { beforeEach, describe, expect, it } from 'vitest';
import { createOfferDocumentSnapshot } from '../domain/offerDocument/createOfferDocumentSnapshot';
import {
  canonicalizeSnapshotForHash,
  computeOfferDocumentContentHash,
  createHashInputFromSnapshot,
  isValidSha256HexHash,
} from '../domain/offerDocument/offerDocumentHash';
import { generateId } from '../utils/id';
import { createTestOffer } from './helpers/offerTestHelpers';
import {
  createPremiumLineOfferInput,
  seedPremiumLineDraftOffer,
  setupOfferDocumentTestStorage,
} from './helpers/offerDocumentTestHelpers';

describe('Offer document hash', () => {
  beforeEach(() => {
    setupOfferDocumentTestStorage();
  });

  it('validates SHA-256 hex hashes', () => {
    expect(isValidSha256HexHash('a'.repeat(64))).toBe(true);
    expect(isValidSha256HexHash('ABCDEF0123456789'.repeat(4).toLowerCase())).toBe(true);
    expect(isValidSha256HexHash('')).toBe(false);
    expect(isValidSha256HexHash('abc')).toBe(false);
    expect(isValidSha256HexHash('g'.repeat(64))).toBe(false);
  });

  it('excludes contentHash from hash input', async () => {
    const offer = createTestOffer({ id: 'offer_hash_test' });
    const snapshot = await createOfferDocumentSnapshot({
      documentId: generateId('offer_doc'),
      documentVersion: 1,
      offer,
      generatedAt: '2026-07-30T10:00:00.000Z',
      generatedByUserId: 'user_001',
      generatedByDisplayName: 'Laura Berger',
    });

    const hashInput = createHashInputFromSnapshot(snapshot);
    expect(hashInput).not.toHaveProperty('contentHash');
  });

  it('produces stable canonical JSON regardless of key order', async () => {
    const offer = createTestOffer({ id: 'offer_canonical' });
    const snapshot = await createOfferDocumentSnapshot({
      documentId: generateId('offer_doc'),
      documentVersion: 1,
      offer,
      generatedAt: '2026-07-30T10:00:00.000Z',
      generatedByUserId: 'user_001',
      generatedByDisplayName: 'Laura Berger',
    });

    const canonical = canonicalizeSnapshotForHash(snapshot);
    expect(canonical).toBe(canonicalizeSnapshotForHash({ ...snapshot }));
    expect(() => JSON.parse(canonical)).not.toThrow();
  });

  it('computes deterministic content hash for identical snapshots', async () => {
    const offer = createTestOffer({ id: 'offer_deterministic' });
    const baseInput = {
      documentId: 'offer_doc_deterministic',
      documentVersion: 1,
      offer,
      generatedAt: '2026-07-30T10:00:00.000Z',
      generatedByUserId: 'user_001',
      generatedByDisplayName: 'Laura Berger',
    };

    const snapshotA = await createOfferDocumentSnapshot(baseInput);
    const snapshotB = await createOfferDocumentSnapshot(baseInput);

    expect(snapshotA.contentHash).toBe(snapshotB.contentHash);
    expect(isValidSha256HexHash(snapshotA.contentHash)).toBe(true);
  });

  it('changes hash when snapshot content changes', async () => {
    const offer = createTestOffer({ id: 'offer_change', title: 'Original' });
    const baseInput = {
      documentId: generateId('offer_doc'),
      documentVersion: 1,
      offer,
      generatedAt: '2026-07-30T10:00:00.000Z',
      generatedByUserId: 'user_001',
      generatedByDisplayName: 'Laura Berger',
    };

    const original = await createOfferDocumentSnapshot(baseInput);
    const changed = await createOfferDocumentSnapshot({
      ...baseInput,
      offer: { ...offer, title: 'Geändert' },
    });

    expect(original.contentHash).not.toBe(changed.contentHash);
  });

  it('computes hash directly from snapshot without contentHash field', async () => {
    const offer = createTestOffer({ id: 'offer_direct_hash' });
    const snapshot = await createOfferDocumentSnapshot({
      documentId: generateId('offer_doc'),
      documentVersion: 1,
      offer,
      generatedAt: '2026-07-30T10:00:00.000Z',
      generatedByUserId: 'user_001',
      generatedByDisplayName: 'Laura Berger',
    });

    const { contentHash, ...withoutHash } = snapshot;
    const recomputed = await computeOfferDocumentContentHash(withoutHash);

    expect(recomputed).toBe(contentHash);
  });

  it('includes Premium Line totals in hash input', async () => {
    const offer = await seedPremiumLineDraftOffer();
    const snapshot = await createOfferDocumentSnapshot({
      documentId: generateId('offer_doc'),
      documentVersion: 1,
      offer,
      generatedAt: '2026-07-30T10:00:00.000Z',
      generatedByUserId: 'user_001',
      generatedByDisplayName: 'Laura Berger',
    });

    expect(snapshot.totals.monthlyTotalCents).toBe(11995);
    expect(snapshot.totals.oneTimeTotalCents).toBe(64990);
    expect(createPremiumLineOfferInput().items).toHaveLength(3);
    expect(isValidSha256HexHash(snapshot.contentHash)).toBe(true);
  });
});
