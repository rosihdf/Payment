import { beforeEach, describe, expect, it } from 'vitest';
import { createPreviewDocumentSnapshot } from '../domain/offerDocument/createOfferDocumentSnapshot';
import {
  ADMIN_CONTEXT,
  FIELD_SERVICE_CONTEXT,
  OTHER_FIELD_SERVICE_CONTEXT,
} from './helpers/offerTestHelpers';
import {
  createOfferServicesForTests,
  PREMIUM_LINE_MONTHLY_CENTS,
  PREMIUM_LINE_ONE_TIME_TOTAL_CENTS,
  seedOfferDocumentInStorage,
  seedPremiumLineCompletedOffer,
  seedPremiumLineDraftOffer,
  setupOfferDocumentTestStorage,
} from './helpers/offerDocumentTestHelpers';

describe('OfferDocumentService', () => {
  beforeEach(() => {
    setupOfferDocumentTestStorage();
  });

  it('creates preview snapshot for accessible draft offer', async () => {
    const { offerDocumentService } = createOfferServicesForTests();
    const offer = await seedPremiumLineDraftOffer();

    const result = await offerDocumentService.createPreviewSnapshot(offer.id, FIELD_SERVICE_CONTEXT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.documentNumber).toBe('VORSCHAU');
      expect(result.snapshot.contentHash).toBe('');
      expect(result.snapshot.totals.monthlyTotalCents).toBe(PREMIUM_LINE_MONTHLY_CENTS);
      expect(result.snapshot.totals.oneTimeTotalCents).toBe(PREMIUM_LINE_ONE_TIME_TOTAL_CENTS);
    }
  });

  it('generates preview pdf blob for draft offer', async () => {
    const { offerDocumentService } = createOfferServicesForTests();
    const offer = await seedPremiumLineDraftOffer();

    const result = await offerDocumentService.generatePreviewPdf(offer.id, FIELD_SERVICE_CONTEXT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.isPreview).toBe(true);
      expect(result.filename).toContain('VORSCHAU');
      expect(result.blob.type).toBe('application/pdf');
    }
  });

  it('creates final document for completed offer', async () => {
    const { offerDocumentService } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer();

    const result = await offerDocumentService.createFinalDocument(offer.id, FIELD_SERVICE_CONTEXT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.version).toBe(1);
      expect(result.document.status).toBe('generated');
      expect(result.document.documentNumber).toMatch(/-V1$/);
      expect(result.document.snapshot.totals.monthlyTotalCents).toBe(PREMIUM_LINE_MONTHLY_CENTS);
      expect(result.document.snapshot.totals.oneTimeTotalCents).toBe(PREMIUM_LINE_ONE_TIME_TOTAL_CENTS);
    }
  });

  it('prevents duplicate final document for same offer', async () => {
    const { offerDocumentService } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer();

    const first = await offerDocumentService.createFinalDocument(offer.id, FIELD_SERVICE_CONTEXT);
    const second = await offerDocumentService.createFinalDocument(offer.id, FIELD_SERVICE_CONTEXT);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok && !('errors' in second)) {
      expect(second.error).toBe('already_exists');
    }
  });

  it('creates new final version and supersedes previous document', async () => {
    const { offerDocumentService } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer();

    const first = await offerDocumentService.createFinalDocument(offer.id, FIELD_SERVICE_CONTEXT);
    expect(first.ok).toBe(true);

    const second = await offerDocumentService.createNewFinalVersion(offer.id, FIELD_SERVICE_CONTEXT);

    expect(second.ok).toBe(true);
    if (second.ok && first.ok) {
      expect(second.document.version).toBe(2);
      const documents = await offerDocumentService.getDocumentsForOffer(offer.id, FIELD_SERVICE_CONTEXT);
      const superseded = documents.find((document) => document.id === first.document.id);
      expect(superseded?.status).toBe('superseded');
      expect(documents.find((document) => document.status === 'generated')?.version).toBe(2);
    }
  });

  it('rejects new final version for cancelled offer', async () => {
    const { offerService, offerDocumentService } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer();
    await offerService.cancelOffer(offer.id, 'Kunde hat abgesagt', FIELD_SERVICE_CONTEXT);

    const result = await offerDocumentService.createNewFinalVersion(offer.id, FIELD_SERVICE_CONTEXT);

    expect(result.ok).toBe(false);
    if (!result.ok && !('errors' in result)) {
      expect(result.error).toBe('invalid_status');
    }
  });

  it('limits field service access to own offers', async () => {
    const { offerDocumentService } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer(OTHER_FIELD_SERVICE_CONTEXT);

    const documents = await offerDocumentService.getDocumentsForOffer(offer.id, FIELD_SERVICE_CONTEXT);
    expect(documents).toEqual([]);

    const preview = await offerDocumentService.generatePreviewPdf(offer.id, FIELD_SERVICE_CONTEXT);
    expect(preview.ok).toBe(false);
    if (!preview.ok && !('errors' in preview)) {
      expect(preview.error).toBe('forbidden');
    }
  });

  it('allows admin to access all offer documents', async () => {
    const { offerDocumentRepository, offerDocumentService } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer(OTHER_FIELD_SERVICE_CONTEXT);
    await seedOfferDocumentInStorage(offerDocumentRepository, offer, {}, OTHER_FIELD_SERVICE_CONTEXT);

    const documents = await offerDocumentService.getDocumentsForOffer(offer.id, ADMIN_CONTEXT);
    expect(documents).toHaveLength(1);
  });

  it('verifies document integrity for valid snapshot', async () => {
    const { offerDocumentRepository, offerDocumentService } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer();
    const document = await seedOfferDocumentInStorage(offerDocumentRepository, offer);

    const integrity = await offerDocumentService.verifyDocumentIntegrity(
      document.id,
      FIELD_SERVICE_CONTEXT,
    );

    expect(integrity).not.toBeNull();
    expect(integrity?.valid).toBe(true);
    expect(integrity?.expectedHash).toBe(integrity?.actualHash);
  });

  it('detects tampered document integrity', async () => {
    const { offerDocumentRepository, offerDocumentService } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer();
    const document = await seedOfferDocumentInStorage(offerDocumentRepository, offer, {
      id: 'offer_doc_tampered',
    });

    const stored = await offerDocumentRepository.getById(document.id);
    expect(stored).not.toBeNull();
    if (stored) {
      const { STORAGE_KEYS, writeStorageItem } = await import('../utils/storage');
      writeStorageItem(STORAGE_KEYS.offerDocuments, [
        {
          ...stored,
          snapshot: {
            ...stored.snapshot,
            title: 'Manipuliert',
          },
        },
      ]);
    }

    const integrity = await offerDocumentService.verifyDocumentIntegrity(
      'offer_doc_tampered',
      FIELD_SERVICE_CONTEXT,
    );

    expect(integrity?.valid).toBe(false);
  });

  it('generates pdf for stored document', async () => {
    const { offerDocumentRepository, offerDocumentService } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer();
    const document = await seedOfferDocumentInStorage(offerDocumentRepository, offer);

    const result = await offerDocumentService.generatePdfForStoredDocument(
      document.id,
      FIELD_SERVICE_CONTEXT,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.isPreview).toBe(false);
      expect(result.filename).toContain('_V1.pdf');
    }
  });

  it('returns current generated document from list', async () => {
    const { offerDocumentRepository, offerDocumentService } = createOfferServicesForTests();
    const offer = await seedPremiumLineCompletedOffer();
    await seedOfferDocumentInStorage(offerDocumentRepository, offer, {
      id: 'doc_v1',
      version: 1,
      status: 'superseded',
    });
    await seedOfferDocumentInStorage(offerDocumentRepository, offer, {
      id: 'doc_v2',
      version: 2,
      documentNumber: `${offer.offerNumber}-V2`,
    });

    const documents = await offerDocumentService.getDocumentsForOffer(offer.id, FIELD_SERVICE_CONTEXT);
    const current = offerDocumentService.getCurrentGeneratedDocument(documents);

    expect(current?.id).toBe('doc_v2');
  });

  it('uses preview snapshot helper without persisted hash', async () => {
    const offer = await seedPremiumLineDraftOffer();
    const snapshot = await createPreviewDocumentSnapshot(
      offer,
      FIELD_SERVICE_CONTEXT.userId,
      FIELD_SERVICE_CONTEXT.displayName,
    );

    expect(snapshot.documentVersion).toBe(0);
    expect(snapshot.contentHash).toBe('');
    expect(snapshot.totals.oneTimeTotalCents).toBe(PREMIUM_LINE_ONE_TIME_TOTAL_CENTS);
  });
});
