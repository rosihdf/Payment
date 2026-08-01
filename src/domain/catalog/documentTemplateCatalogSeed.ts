import type { DocumentTemplate } from '../template/documentTemplate';

/** Produktive Ausgangskonfiguration – stabile IDs für idempotenten Bootstrap. */
export const PRODUCTION_DOCUMENT_TEMPLATE_OFFER_PDF_ID = 'document_template_offer_pdf_v1';
export const PRODUCTION_DOCUMENT_TEMPLATE_FOLLOW_UP_NOTE_ID = 'document_template_follow_up_note_v1';

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

export function createProductionDocumentTemplates(createdByUserId = 'system'): DocumentTemplate[] {
  return [
    {
      id: PRODUCTION_DOCUMENT_TEMPLATE_OFFER_PDF_ID,
      schemaVersion: 1,
      type: 'offer_pdf',
      name: 'Standard Angebots-PDF',
      versionNumber: 1,
      status: 'active',
      validFrom: '2026-01-01',
      body: 'Angebot {{offerNumber}} Version {{versionNumber}} für {{customerName}}',
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
      createdByUserId,
      createdByDisplayName: 'System',
    },
    {
      id: PRODUCTION_DOCUMENT_TEMPLATE_FOLLOW_UP_NOTE_ID,
      schemaVersion: 1,
      type: 'follow_up_note',
      name: 'Standard Nachfassnotiz',
      versionNumber: 1,
      status: 'active',
      validFrom: '2026-01-01',
      body: 'Nachfassung zu Angebot {{offerNumber}} für {{contactName}}',
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
      createdByUserId,
      createdByDisplayName: 'System',
    },
  ];
}
