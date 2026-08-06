import type { Offer } from '../domain/offer/offer';
import { createOfferDocumentSnapshot, createPreviewDocumentSnapshot } from '../domain/offerDocument/createOfferDocumentSnapshot';
import type {
  OfferDocument,
  OfferDocumentIntegrityResult,
  OfferDocumentSnapshot,
} from '../domain/offerDocument/offerDocument';
import { computeOfferDocumentContentHash } from '../domain/offerDocument/offerDocumentHash';
import { formatOfferDocumentNumber, getNextDocumentVersion } from '../domain/offerDocument/offerDocumentNumber';
import { generateId, nowIso } from '../utils/id';
import { buildFinalPdfFilename, buildPreviewPdfFilename, downloadBlob } from '../utils/downloadBlob';
import type { OfferDocumentRepository } from '../repositories/interfaces/OfferDocumentRepository';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import { OfferDocumentNotFoundError } from '../repositories/errors/OfferDocumentNotFoundError';
import { OfferNotFoundError } from '../repositories/errors/OfferNotFoundError';
import type { OfferUserContext } from './offerService';
import {
  hasValidationErrors,
  validateOfferForFinalDocument,
  validateOfferForPreview,
  validateSenderProfile,
  validateStoredDocumentSnapshot,
  type OfferDocumentValidationErrors,
} from './offerDocumentValidation';
import { renderOfferPdfBlob } from './offerPdfRenderer';

export type OfferDocumentResult =
  | { ok: true; document: OfferDocument }
  | { ok: false; errors: OfferDocumentValidationErrors }
  | { ok: false; error: 'not_found' | 'forbidden' | 'storage' | 'already_exists' | 'invalid_status' };

export type OfferDocumentPdfResult =
  | { ok: true; blob: Blob; filename: string; snapshot: OfferDocumentSnapshot; isPreview: boolean }
  | { ok: false; errors: OfferDocumentValidationErrors }
  | { ok: false; error: 'not_found' | 'forbidden' | 'storage' | 'pdf_failed' };

export class OfferDocumentService {
  private readonly offerDocumentRepository: OfferDocumentRepository;
  private readonly offerRepository: OfferRepository;
  private readonly canAccessOffer: (
    offer: Offer,
    context: OfferUserContext,
  ) => boolean;

  constructor(
    offerDocumentRepository: OfferDocumentRepository,
    offerRepository: OfferRepository,
    canAccessOffer: (offer: Offer, context: OfferUserContext) => boolean,
  ) {
    this.offerDocumentRepository = offerDocumentRepository;
    this.offerRepository = offerRepository;
    this.canAccessOffer = canAccessOffer;
  }

  private async getAccessibleOffer(
    offerId: string,
    context: OfferUserContext,
  ): Promise<Offer | null> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer) {
      return null;
    }
    if (!(await this.canAccessOffer(offer, context))) {
      return null;
    }

    return offer;
  }

  async getDocumentsForOffer(
    offerId: string,
    context: OfferUserContext,
  ): Promise<OfferDocument[]> {
    const offer = await this.getAccessibleOffer(offerId, context);
    if (!offer) {
      return [];
    }

    return this.offerDocumentRepository.getByOfferId(offerId);
  }

  async getDocumentById(
    documentId: string,
    context: OfferUserContext,
  ): Promise<OfferDocument | null> {
    const document = await this.offerDocumentRepository.getById(documentId);
    if (!document) {
      return null;
    }

    const offer = await this.getAccessibleOffer(document.offerId, context);
    if (!offer) {
      return null;
    }

    return document;
  }

  getCurrentGeneratedDocument(documents: OfferDocument[]): OfferDocument | null {
    return documents.find((document) => document.status === 'generated') ?? null;
  }

  async createPreviewSnapshot(
    offerId: string,
    context: OfferUserContext,
  ): Promise<
    | { ok: true; snapshot: OfferDocumentSnapshot }
    | { ok: false; errors: OfferDocumentValidationErrors }
    | { ok: false; error: 'not_found' | 'forbidden' }
  > {
    const offer = await this.getAccessibleOffer(offerId, context);
    if (!offer) {
      return { ok: false, error: 'forbidden' };
    }

    const errors = {
      ...validateOfferForPreview(offer),
      ...validateSenderProfile(),
    };

    if (hasValidationErrors(errors)) {
      return { ok: false, errors };
    }

    const snapshot = await createPreviewDocumentSnapshot(
      offer,
      context.userId,
      context.displayName,
    );

    return { ok: true, snapshot };
  }

  async generatePreviewPdf(
    offerId: string,
    context: OfferUserContext,
  ): Promise<OfferDocumentPdfResult> {
    const preview = await this.createPreviewSnapshot(offerId, context);
    if (!preview.ok) {
      if ('errors' in preview) {
        return { ok: false, errors: preview.errors };
      }

      return { ok: false, error: preview.error === 'forbidden' ? 'forbidden' : 'not_found' };
    }

    try {
      const blob = renderOfferPdfBlob(preview.snapshot, { isPreview: true });
      return {
        ok: true,
        blob,
        filename: buildPreviewPdfFilename(preview.snapshot.offerNumber),
        snapshot: preview.snapshot,
        isPreview: true,
      };
    } catch {
      return { ok: false, error: 'pdf_failed' };
    }
  }

  async createFinalDocument(
    offerId: string,
    context: OfferUserContext,
  ): Promise<OfferDocumentResult> {
    const offer = await this.getAccessibleOffer(offerId, context);
    if (!offer) {
      return { ok: false, error: 'forbidden' };
    }

    const errors = {
      ...validateOfferForFinalDocument(offer),
      ...validateSenderProfile(),
    };

    if (hasValidationErrors(errors)) {
      return { ok: false, errors };
    }

    const existing = await this.offerDocumentRepository.getByOfferId(offerId);
    const current = this.getCurrentGeneratedDocument(existing);
    if (current) {
      return { ok: false, error: 'already_exists' };
    }

    return this.createFinalDocumentVersion(offer, existing, context);
  }

  async createNewFinalVersion(
    offerId: string,
    context: OfferUserContext,
  ): Promise<OfferDocumentResult> {
    const offer = await this.getAccessibleOffer(offerId, context);
    if (!offer) {
      return { ok: false, error: 'forbidden' };
    }

    if (offer.status === 'cancelled') {
      return { ok: false, error: 'invalid_status' };
    }

    const errors = {
      ...validateOfferForFinalDocument(offer),
      ...validateSenderProfile(),
    };

    if (hasValidationErrors(errors)) {
      return { ok: false, errors };
    }

    const existing = await this.offerDocumentRepository.getByOfferId(offerId);
    const current = this.getCurrentGeneratedDocument(existing);

    if (current) {
      try {
        await this.offerDocumentRepository.markSuperseded(current.id);
      } catch {
        return { ok: false, error: 'storage' };
      }
    }

    return this.createFinalDocumentVersion(offer, existing, context);
  }

  private async createFinalDocumentVersion(
    offer: Offer,
    existingDocuments: OfferDocument[],
    context: OfferUserContext,
  ): Promise<OfferDocumentResult> {
    const timestamp = nowIso();
    const version = getNextDocumentVersion(existingDocuments);
    const documentId = generateId('offer_doc');
    const offerVersionId = offer.currentVersionId;
    if (!offerVersionId) {
      return {
        ok: false,
        errors: { offer: 'Angebotsversion fehlt – Finaldokument nur für eine konkrete Version.' },
      };
    }

    const snapshot = await createOfferDocumentSnapshot({
      documentId,
      documentVersion: version,
      offer,
      offerVersionId,
      generatedAt: timestamp,
      generatedByUserId: context.userId,
      generatedByDisplayName: context.displayName,
    });

    const snapshotErrors = validateStoredDocumentSnapshot(snapshot, offer.offerNumber, version);
    if (hasValidationErrors(snapshotErrors)) {
      return { ok: false, errors: snapshotErrors };
    }

    const document: OfferDocument = {
      id: documentId,
      offerId: offer.id,
      offerVersionId,
      offerNumber: offer.offerNumber,
      documentNumber: formatOfferDocumentNumber(offer.offerNumber, version),
      version,
      status: 'generated',
      snapshot,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      const created = await this.offerDocumentRepository.create(document);
      return { ok: true, document: created };
    } catch {
      return { ok: false, error: 'storage' };
    }
  }

  async generatePdfForStoredDocument(
    documentId: string,
    context: OfferUserContext,
  ): Promise<OfferDocumentPdfResult> {
    const document = await this.getDocumentById(documentId, context);
    if (!document) {
      return { ok: false, error: 'not_found' };
    }

    try {
      const blob = renderOfferPdfBlob(document.snapshot, { isPreview: false });
      return {
        ok: true,
        blob,
        filename: buildFinalPdfFilename(document.offerNumber, document.version),
        snapshot: document.snapshot,
        isPreview: false,
      };
    } catch {
      return { ok: false, error: 'pdf_failed' };
    }
  }

  async downloadStoredDocument(
    documentId: string,
    context: OfferUserContext,
  ): Promise<
    | { ok: true }
    | { ok: false; error: 'not_found' | 'forbidden' | 'pdf_failed' }
  > {
    const result = await this.generatePdfForStoredDocument(documentId, context);
    if (!result.ok) {
      if ('errors' in result) {
        return { ok: false, error: 'pdf_failed' };
      }

      return { ok: false, error: result.error === 'storage' ? 'pdf_failed' : result.error };
    }

    downloadBlob(result.blob, result.filename);
    return { ok: true };
  }

  async verifyDocumentIntegrity(
    documentId: string,
    context: OfferUserContext,
  ): Promise<OfferDocumentIntegrityResult | null> {
    const document = await this.getDocumentById(documentId, context);
    if (!document) {
      return null;
    }

    const { contentHash, ...withoutHash } = document.snapshot;
    const actualHash = await computeOfferDocumentContentHash(withoutHash);

    return {
      documentId: document.id,
      valid: actualHash === contentHash,
      expectedHash: contentHash,
      actualHash,
      checkedAt: nowIso(),
    };
  }
}

export function createOfferDocumentService(
  offerDocumentRepository: OfferDocumentRepository,
  offerRepository: OfferRepository,
  offerService: {
    getOfferById: (id: string, context: OfferUserContext) => Promise<Offer | null>;
  },
): OfferDocumentService {
  return new OfferDocumentService(
    offerDocumentRepository,
    offerRepository,
    async (offer, context) => (await offerService.getOfferById(offer.id, context)) !== null,
  );
}

export { OfferNotFoundError, OfferDocumentNotFoundError };
