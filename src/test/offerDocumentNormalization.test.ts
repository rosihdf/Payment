import { describe, expect, it } from 'vitest';
import {
  normalizeOfferDocument,
  normalizeOfferDocuments,
  stripBinaryFieldsFromDocument,
} from '../domain/offerDocument/normalizeOfferDocument';
import { CURRENT_OFFER_DOCUMENT_SCHEMA_VERSION } from '../domain/offerDocument/offerDocument';
import { createTestOffer } from './helpers/offerTestHelpers';
import { createTestOfferDocument } from './helpers/offerDocumentTestHelpers';

describe('Offer document normalization', () => {
  it('loads legacy document without crashing', () => {
    const normalized = normalizeOfferDocument({
      id: 'offer_doc_legacy',
      offerId: 'offer_001',
    });

    expect(normalized.id).toBe('offer_doc_legacy');
    expect(normalized.offerId).toBe('offer_001');
    expect(normalized.status).toBe('generated');
    expect(normalized.version).toBe(1);
    expect(normalized.snapshot.schemaVersion).toBe(CURRENT_OFFER_DOCUMENT_SCHEMA_VERSION);
  });

  it('applies defaults for missing snapshot fields', () => {
    const normalized = normalizeOfferDocument({
      id: 'offer_doc_min',
      offerNumber: 'BP-ANG-2026-0001',
      documentNumber: 'BP-ANG-2026-0001-V1',
      snapshot: {
        title: 'Minimal',
      },
    });

    expect(normalized.snapshot.title).toBe('Minimal');
    expect(normalized.snapshot.items).toEqual([]);
    expect(normalized.snapshot.totals.monthlyTotalCents).toBe(0);
    expect(normalized.snapshot.totals.oneTimeTotalCents).toBe(0);
    expect(normalized.snapshot.sender.companyName).toBe('');
  });

  it('preserves existing values', async () => {
    const offer = createTestOffer({ id: 'offer_preserve' });
    const source = await createTestOfferDocument(offer, {
      id: 'offer_doc_preserve',
      status: 'superseded',
      version: 2,
      documentNumber: 'BP-ANG-2026-0001-V2',
    });

    const normalized = normalizeOfferDocument(source);

    expect(normalized.id).toBe('offer_doc_preserve');
    expect(normalized.status).toBe('superseded');
    expect(normalized.version).toBe(2);
    expect(normalized.snapshot.documentNumber).toBe('BP-ANG-2026-0001-V2');
    expect(normalized.snapshot.contentHash).toBe(source.snapshot.contentHash);
  });

  it('clears invalid content hash values', () => {
    const normalized = normalizeOfferDocument({
      id: 'offer_doc_bad_hash',
      snapshot: {
        contentHash: 'not-a-valid-hash',
      },
    });

    expect(normalized.snapshot.contentHash).toBe('');
  });

  it('syncs snapshot document number from document when missing', () => {
    const normalized = normalizeOfferDocument({
      id: 'offer_doc_number_sync',
      documentNumber: 'BP-ANG-2026-0003-V1',
      snapshot: {
        documentNumber: '',
      },
    });

    expect(normalized.snapshot.documentNumber).toBe('BP-ANG-2026-0003-V1');
  });

  it('normalizes document arrays', () => {
    const documents = normalizeOfferDocuments([
      { id: 'offer_doc_a', offerId: 'offer_a' },
      { id: 'offer_doc_b', offerId: 'offer_b', status: 'superseded' },
    ]);

    expect(documents).toHaveLength(2);
    expect(documents[0]?.status).toBe('generated');
    expect(documents[1]?.status).toBe('superseded');
  });

  it('strips binary fields from stored documents', () => {
    const cleaned = stripBinaryFieldsFromDocument({
      id: 'offer_doc_binary',
      pdfData: 'base64data',
      pdfBase64: 'base64data',
      binaryData: new Uint8Array([1, 2, 3]),
      htmlContent: '<html></html>',
      snapshot: {
        pdfData: 'nested',
        title: 'Behalten',
      },
    }) as Record<string, unknown>;

    expect(cleaned.pdfData).toBeUndefined();
    expect(cleaned.pdfBase64).toBeUndefined();
    expect(cleaned.binaryData).toBeUndefined();
    expect(cleaned.htmlContent).toBeUndefined();
    expect((cleaned.snapshot as Record<string, unknown>).pdfData).toBeUndefined();
    expect((cleaned.snapshot as Record<string, unknown>).title).toBe('Behalten');
  });
});
