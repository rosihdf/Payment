import { beforeEach, describe, expect, it } from 'vitest';
import { renderOfferPdf } from '../services/offerPdfRenderer';
import {
  clearDemoDataForTests,
  createTestOfferDocument,
  resetDemoDataForTests,
  seedPremiumLineCompletedOffer,
  seedPremiumLineDraftOffer,
} from './helpers/offerDocumentTestHelpers';

describe('Angebots-PDF Renderer', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('erzeugt ein druckbares PDF mit Hardware und Laufzeit', async () => {
    const offer = await seedPremiumLineCompletedOffer();
    const document = await createTestOfferDocument(offer);
    const bytes = renderOfferPdf(document.snapshot, { isPreview: false });
    expect(bytes.byteLength).toBeGreaterThan(1000);
    const asText = new TextDecoder('latin1').decode(bytes);
    expect(asText).toContain('Ihr Angebot');
    expect(asText).toContain('AMRtech');
    expect(asText).not.toMatch(/commission|user_|lead_/i);
  });

  it('erzeugt ein PDF ohne Hardware und mit 0-€-Ausgangslage', async () => {
    const offer = await seedPremiumLineDraftOffer();
    offer.tariffSnapshot = offer.tariffSnapshot
      ? {
          ...offer.tariffSnapshot,
          monthlyTerminalRentalCents: 0,
          monthlyAccountBaseFeeCents: 0,
          monthlyServiceFeePerTerminalCents: 0,
          setupFeeCents: 0,
          contractDurationMonths: null,
        }
      : null;
    offer.items = [];
    const document = await createTestOfferDocument(offer);
    const bytes = renderOfferPdf(document.snapshot, { isPreview: true });
    expect(bytes.byteLength).toBeGreaterThan(500);
    const asText = new TextDecoder('latin1').decode(bytes);
    expect(asText).toContain('Ihr Angebot');
  });
});
