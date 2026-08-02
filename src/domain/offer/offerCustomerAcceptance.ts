/**
 * Dokumentierte Kundenannahme – Phase 1B Block 1.
 * Kein Ersatz für BestPay-Vertrag; keine Signatur in diesem Block.
 */
export interface OfferCustomerAcceptanceCheckboxes {
  /** Angebot geprüft */
  offerReviewed: boolean;
  /** Konditionen verstanden */
  termsUnderstood: boolean;
  /** Annahme beabsichtigt */
  acceptanceIntended: boolean;
}

export interface OfferCustomerAcceptance {
  id: string;
  offerId: string;
  offerVersionId: string;
  acceptorName: string;
  acceptedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  checkboxes: OfferCustomerAcceptanceCheckboxes;
  comment: string;
  shareId: string | null;
  createdAt: string;
}

export function validateCustomerAcceptanceCheckboxes(
  checkboxes: OfferCustomerAcceptanceCheckboxes,
): string[] {
  const issues: string[] = [];
  if (!checkboxes.offerReviewed) {
    issues.push('Bestätigung „Angebot geprüft“ fehlt.');
  }
  if (!checkboxes.termsUnderstood) {
    issues.push('Bestätigung „Konditionen verstanden“ fehlt.');
  }
  if (!checkboxes.acceptanceIntended) {
    issues.push('Bestätigung „Annahme beabsichtigt“ fehlt.');
  }
  return issues;
}

export function isCustomerAcceptanceComplete(acceptance: OfferCustomerAcceptance): boolean {
  return validateCustomerAcceptanceCheckboxes(acceptance.checkboxes).length === 0
    && acceptance.acceptorName.trim().length > 0;
}
