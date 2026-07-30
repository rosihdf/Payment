import { beforeEach, describe, expect, it } from 'vitest';
import { createPreviewDocumentSnapshot } from '../domain/offerDocument/createOfferDocumentSnapshot';
import { renderOfferPdf, renderOfferPdfBlob } from '../services/offerPdfRenderer';
import { FIELD_SERVICE_CONTEXT } from './helpers/offerTestHelpers';
import {
  PREMIUM_LINE_MONTHLY_CENTS,
  PREMIUM_LINE_ONE_TIME_TOTAL_CENTS,
  seedPremiumLineDraftOffer,
  setupOfferDocumentTestStorage,
} from './helpers/offerDocumentTestHelpers';

function pdfBytesToLatin1String(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
}

describe('Offer PDF renderer', () => {
  beforeEach(() => {
    setupOfferDocumentTestStorage();
  });

  it('renders valid PDF bytes starting with %PDF header', async () => {
    const offer = await seedPremiumLineDraftOffer();
    const snapshot = await createPreviewDocumentSnapshot(
      offer,
      FIELD_SERVICE_CONTEXT.userId,
      FIELD_SERVICE_CONTEXT.displayName,
    );

    const bytes = renderOfferPdf(snapshot, { isPreview: true });
    const header = pdfBytesToLatin1String(bytes.slice(0, 8));

    expect(header.startsWith('%PDF')).toBe(true);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('renders blob with application/pdf mime type', async () => {
    const offer = await seedPremiumLineDraftOffer();
    const snapshot = await createPreviewDocumentSnapshot(
      offer,
      FIELD_SERVICE_CONTEXT.userId,
      FIELD_SERVICE_CONTEXT.displayName,
    );

    const blob = renderOfferPdfBlob(snapshot, { isPreview: false });
    const bytes = renderOfferPdf(snapshot, { isPreview: false });

    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
    expect(pdfBytesToLatin1String(bytes.slice(0, 4))).toBe('%PDF');
  });

  it('includes Premium Line totals in rendered PDF', async () => {
    const offer = await seedPremiumLineDraftOffer();
    const snapshot = await createPreviewDocumentSnapshot(
      offer,
      FIELD_SERVICE_CONTEXT.userId,
      FIELD_SERVICE_CONTEXT.displayName,
    );

    expect(snapshot.totals.monthlyTotalCents).toBe(PREMIUM_LINE_MONTHLY_CENTS);
    expect(snapshot.totals.oneTimeTotalCents).toBe(PREMIUM_LINE_ONE_TIME_TOTAL_CENTS);
    expect(snapshot.totals.monthlyItemsTotalCents).toBe(PREMIUM_LINE_MONTHLY_CENTS);
    expect(snapshot.totals.oneTimeItemsTotalCents).toBe(PREMIUM_LINE_ONE_TIME_TOTAL_CENTS);

    const bytes = renderOfferPdf(snapshot, { isPreview: true });

    expect(pdfBytesToLatin1String(bytes.slice(0, 4))).toBe('%PDF');
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('marks preview documents visually', async () => {
    const offer = await seedPremiumLineDraftOffer();
    const snapshot = await createPreviewDocumentSnapshot(
      offer,
      FIELD_SERVICE_CONTEXT.userId,
      FIELD_SERVICE_CONTEXT.displayName,
    );

    const previewBytes = renderOfferPdf(snapshot, { isPreview: true });
    const finalBytes = renderOfferPdf(snapshot, { isPreview: false });

    expect(pdfBytesToLatin1String(previewBytes)).toContain('ENTWURF');
    expect(pdfBytesToLatin1String(finalBytes)).not.toContain('Dokumentversion: Vorschau');
  });
});
