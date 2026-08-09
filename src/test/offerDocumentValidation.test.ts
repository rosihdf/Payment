import { beforeEach, describe, expect, it } from 'vitest';
import { createOfferDocumentSnapshot } from '../domain/offerDocument/createOfferDocumentSnapshot';
import {
  hasValidationErrors,
  validateOfferForFinalDocument,
  validateOfferForPreview,
  validateSenderProfile,
  validateStoredDocumentSnapshot,
} from '../services/offerDocumentValidation';
import { generateId } from '../utils/id';
import { createTestOffer } from './helpers/offerTestHelpers';
import {
  createPremiumLineOfferInput,
  createOfferServicesForTests,
  seedPremiumLineCompletedOffer,
  seedPremiumLineDraftOffer,
  setupOfferDocumentTestStorage,
} from './helpers/offerDocumentTestHelpers';

describe('Offer document validation', () => {
  beforeEach(() => {
    setupOfferDocumentTestStorage();
  });

  it('requires offer for preview validation', () => {
    const errors = validateOfferForPreview(null);
    expect(errors.offer).toBeTruthy();
    expect(hasValidationErrors(errors)).toBe(true);
  });

  it('accepts valid draft offer for preview', async () => {
    const offer = await seedPremiumLineDraftOffer();
    const errors = validateOfferForPreview(offer);

    expect(errors.offer).toBeUndefined();
    expect(errors.title).toBeUndefined();
    expect(errors.customer).toBeUndefined();
    expect(errors.content).toBeUndefined();
    expect(hasValidationErrors(errors)).toBe(false);
  });

  it('rejects cancelled offers for preview', () => {
    const offer = createTestOffer({
      status: 'cancelled',
      cancelledAt: '2026-08-01T10:00:00.000Z',
    });

    expect(validateOfferForPreview(offer).offer).toContain('stornierte');
  });

  it('blocks draft offer for final document without workflow approval', async () => {
    const draft = await seedPremiumLineDraftOffer();
    const errors = validateOfferForFinalDocument(draft);

    expect(errors.status ?? errors.publication).toBeTruthy();
  });

  it('accepts completed Premium Line offer for final document', async () => {
    const offer = await seedPremiumLineCompletedOffer();
    const errors = validateOfferForFinalDocument(offer);

    expect(hasValidationErrors(errors)).toBe(false);
  });

  it('requires minimum content of tariff or items', () => {
    const offer = createTestOffer({
      tariffSnapshot: null,
      items: [],
      title: 'Leer',
    });

    expect(validateOfferForPreview(offer).content).toBeTruthy();
  });

  it('accepts tariff-only offers for preview', () => {
    const offer = createTestOffer({ items: [] });
    const errors = validateOfferForPreview(offer);

    expect(errors.content).toBeUndefined();
  });

  it('validates stored snapshot fields', async () => {
    const offer = await seedPremiumLineCompletedOffer();
    const snapshot = await createOfferDocumentSnapshot({
      documentId: generateId('offer_doc'),
      documentVersion: 1,
      offer,
      generatedAt: '2026-07-30T10:00:00.000Z',
      generatedByUserId: 'user_001',
      generatedByDisplayName: 'Laura Berger',
    });

    const errors = validateStoredDocumentSnapshot(snapshot, offer.offerNumber, 1);

    expect(hasValidationErrors(errors)).toBe(false);
    expect(snapshot.totals.monthlyTotalCents).toBe(11995);
    expect(snapshot.totals.oneTimeTotalCents).toBe(64990);
  });

  it('rejects snapshot with invalid document number', async () => {
    const offer = await seedPremiumLineCompletedOffer();
    const snapshot = await createOfferDocumentSnapshot({
      documentId: generateId('offer_doc'),
      documentVersion: 1,
      offer,
      generatedAt: '2026-07-30T10:00:00.000Z',
      generatedByUserId: 'user_001',
      generatedByDisplayName: 'Laura Berger',
    });

    snapshot.documentNumber = 'INVALID';

    expect(validateStoredDocumentSnapshot(snapshot, offer.offerNumber, 1).documentNumber).toBeTruthy();
  });

  it('validates sender profile from company data', () => {
    const errors = validateSenderProfile();
    expect(errors.sender).toBeUndefined();
  });

  it('detects validation errors helper', () => {
    expect(hasValidationErrors({})).toBe(false);
    expect(hasValidationErrors({ title: 'Fehler' })).toBe(true);
  });

  it('validates Premium Line input shape', () => {
    const input = createPremiumLineOfferInput();
    expect(input.items).toHaveLength(3);
    expect(input.tariffId).toBeNull();
  });

  it('rejects draft offer through service final document path', async () => {
    const { offerDocumentService } = createOfferServicesForTests();
    const draft = await seedPremiumLineDraftOffer();

    const result = await offerDocumentService.createFinalDocument(draft.id, {
      userId: 'user_001',
      role: 'field_service',
      displayName: 'Laura Berger',
    });

    expect(result.ok).toBe(false);
    if (!result.ok && 'errors' in result) {
      expect(result.errors.status).toBeTruthy();
    }
  });
});
