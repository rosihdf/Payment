import type { Offer } from '../domain/offer/offer';
import type { OfferDocumentSnapshot } from '../domain/offerDocument/offerDocument';
import { isValidOfferDocumentNumber } from '../domain/offerDocument/offerDocumentNumber';
import { isValidSha256HexHash } from '../domain/offerDocument/offerDocumentHash';
import { getCompanyProfile } from '../domain/company/companyProfile';

export type OfferDocumentValidationErrors = Record<string, string>;

function hasMinimumContent(offer: Offer): boolean {
  return Boolean(offer.tariffSnapshot) || offer.items.length > 0;
}

export function validateOfferForPreview(offer: Offer | null): OfferDocumentValidationErrors {
  const errors: OfferDocumentValidationErrors = {};

  if (!offer) {
    errors.offer = 'Angebot wurde nicht gefunden.';
    return errors;
  }

  if (offer.status === 'cancelled') {
    errors.offer = 'Für stornierte Angebote kann keine neue Vorschau erzeugt werden.';
  }

  if (!offer.title.trim()) {
    errors.title = 'Angebotstitel fehlt.';
  }

  if (!offer.customerSnapshot.companyName.trim()) {
    errors.customer = 'Kundensnapshot fehlt.';
  }

  if (!hasMinimumContent(offer)) {
    errors.content = 'Mindestens Tarif oder Position erforderlich.';
  }

  return errors;
}

export function validateOfferForFinalDocument(offer: Offer | null): OfferDocumentValidationErrors {
  const errors = validateOfferForPreview(offer);

  if (!offer) {
    return errors;
  }

  if (offer.status !== 'completed') {
    errors.status = 'Finales PDF nur für abgeschlossene Angebote möglich.';
  }

  return errors;
}

export function validateStoredDocumentSnapshot(
  snapshot: OfferDocumentSnapshot,
  offerNumber: string,
  version: number,
): OfferDocumentValidationErrors {
  const errors: OfferDocumentValidationErrors = {};

  if (!snapshot.title.trim()) {
    errors.title = 'Titel fehlt im Snapshot.';
  }

  if (!snapshot.customer.companyName.trim()) {
    errors.customer = 'Kundensnapshot fehlt.';
  }

  if (!snapshot.sender.companyName.trim()) {
    errors.sender = 'Absenderdaten fehlen.';
  }

  if (!snapshot.offerNumber.trim()) {
    errors.offerNumber = 'Angebotsnummer fehlt.';
  }

  if (!isValidOfferDocumentNumber(snapshot.documentNumber, offerNumber, version)) {
    errors.documentNumber = 'Dokumentnummer ist ungültig.';
  }

  if (!snapshot.tariff && snapshot.items.length === 0) {
    errors.content = 'Snapshot enthält weder Tarif noch Positionen.';
  }

  if (!isValidSha256HexHash(snapshot.contentHash)) {
    errors.contentHash = 'Prüfsumme fehlt oder ist ungültig.';
  }

  if (snapshot.totals.monthlyTotalCents < 0 || snapshot.totals.oneTimeTotalCents < 0) {
    errors.totals = 'Summen dürfen nicht negativ sein.';
  }

  return errors;
}

export function validateSenderProfile(): OfferDocumentValidationErrors {
  const profile = getCompanyProfile();
  const errors: OfferDocumentValidationErrors = {};

  if (!profile.companyName.trim()) {
    errors.sender = 'Absenderfirmenname fehlt.';
  }

  return errors;
}

export function hasValidationErrors(errors: OfferDocumentValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
