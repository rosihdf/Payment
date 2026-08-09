import { getCompanyProfile } from '../company/companyProfile';
import type { Offer, OfferItem } from '../offer/offer';
import { calculateOfferTotals } from '../offer/offerCalculations';
import { copyCustomerSnapshot, copyTariffSnapshot } from '../offer/offerSnapshots';
import { computeOfferDocumentContentHash } from './offerDocumentHash';
import { formatOfferDocumentNumber } from './offerDocumentNumber';
import { resolveOfferDocumentCommercialSnapshot } from './offerDocumentCommercialSnapshot';
import type {
  OfferDocumentSenderSnapshot,
  OfferDocumentSnapshot,
} from './offerDocument';
import { CURRENT_OFFER_DOCUMENT_SCHEMA_VERSION } from './offerDocument';

function createSenderSnapshot(): OfferDocumentSenderSnapshot {
  const profile = getCompanyProfile();

  return {
    companyName: profile.companyName,
    legalForm: profile.legalForm,
    street: profile.street,
    postalCode: profile.postalCode,
    city: profile.city,
    phone: profile.phone,
    email: profile.email,
    website: profile.website,
    managingDirector: profile.managingDirector,
    registerCourt: profile.registerCourt,
    registerNumber: profile.registerNumber,
    vatId: profile.vatId,
    bankName: profile.bankName,
    iban: profile.iban,
    bic: profile.bic,
  };
}

function copyOfferItemForDocument(item: OfferItem): OfferItem {
  return {
    ...item,
    productSnapshot: item.productSnapshot ? { ...item.productSnapshot } : null,
  };
}

export interface CreateOfferDocumentSnapshotInput {
  documentId: string;
  documentVersion: number;
  offer: Offer;
  /** Pflicht für Final-Dokumente ab Phase 1B Block 1. */
  offerVersionId?: string | null;
  generatedAt: string;
  generatedByUserId: string;
  generatedByDisplayName: string;
}

export async function createOfferDocumentSnapshot(
  input: CreateOfferDocumentSnapshotInput,
): Promise<OfferDocumentSnapshot> {
  const items = input.offer.items.map(copyOfferItemForDocument);
  const totals = calculateOfferTotals({
    items,
    tariffSnapshot: input.offer.tariffSnapshot,
    commercialSnapshot: input.offer.commercialSnapshot,
  });

  const cancellationState =
    input.offer.status === 'cancelled'
      ? {
          cancelledAt: input.offer.cancelledAt,
          cancellationReason: input.offer.cancellationReason,
        }
      : null;

  const documentNumber = formatOfferDocumentNumber(input.offer.offerNumber, input.documentVersion);
  const commercial = resolveOfferDocumentCommercialSnapshot(input.offer.commercialSnapshot);

  const withoutHash: Omit<OfferDocumentSnapshot, 'contentHash'> = {
    schemaVersion: CURRENT_OFFER_DOCUMENT_SCHEMA_VERSION,
    documentId: input.documentId,
    documentNumber,
    documentVersion: input.documentVersion,
    offerId: input.offer.id,
    offerVersionId: input.offerVersionId ?? input.offer.currentVersionId ?? null,
    offerNumber: input.offer.offerNumber,
    offerStatusAtGeneration: input.offer.status,
    offerUpdatedAtAtGeneration: input.offer.updatedAt,
    generatedAt: input.generatedAt,
    generatedByUserId: input.generatedByUserId,
    generatedByDisplayName: input.generatedByDisplayName,
    sender: createSenderSnapshot(),
    customer: copyCustomerSnapshot(input.offer.customerSnapshot),
    title: input.offer.title,
    introductionText: input.offer.introductionText,
    customerNotes: input.offer.customerNotes,
    validUntil: input.offer.validUntil,
    tariff: input.offer.tariffSnapshot ? copyTariffSnapshot(input.offer.tariffSnapshot) : null,
    items,
    totals,
    commercial,
    cancellationState,
  };

  const contentHash = await computeOfferDocumentContentHash(withoutHash);

  return {
    ...withoutHash,
    contentHash,
  };
}

export async function createPreviewDocumentSnapshot(
  offer: Offer,
  generatedByUserId: string,
  generatedByDisplayName: string,
): Promise<Omit<OfferDocumentSnapshot, 'contentHash'> & { contentHash: '' }> {
  const timestamp = new Date().toISOString();
  const items = offer.items.map(copyOfferItemForDocument);
  const totals = calculateOfferTotals({
    items,
    tariffSnapshot: offer.tariffSnapshot,
    commercialSnapshot: offer.commercialSnapshot,
  });
  const commercial = resolveOfferDocumentCommercialSnapshot(offer.commercialSnapshot);

  return {
    schemaVersion: CURRENT_OFFER_DOCUMENT_SCHEMA_VERSION,
    documentId: 'preview',
    documentNumber: 'VORSCHAU',
    documentVersion: 0,
    offerId: offer.id,
    offerVersionId: offer.currentVersionId,
    offerNumber: offer.offerNumber,
    offerStatusAtGeneration: offer.status,
    offerUpdatedAtAtGeneration: offer.updatedAt,
    generatedAt: timestamp,
    generatedByUserId,
    generatedByDisplayName,
    sender: createSenderSnapshot(),
    customer: copyCustomerSnapshot(offer.customerSnapshot),
    title: offer.title,
    introductionText: offer.introductionText,
    customerNotes: offer.customerNotes,
    validUntil: offer.validUntil,
    tariff: offer.tariffSnapshot ? copyTariffSnapshot(offer.tariffSnapshot) : null,
    items,
    totals,
    commercial,
    cancellationState:
      offer.status === 'cancelled'
        ? {
            cancelledAt: offer.cancelledAt,
            cancellationReason: offer.cancellationReason,
          }
        : null,
    contentHash: '',
  };
}
