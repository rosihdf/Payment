import type { OfferVersionSnapshot } from './offerVersion';

export interface OfferVersionSnapshotValidation {
  valid: boolean;
  issues: string[];
}

/** Shared guard for wizard, activation and PDF generation. */
export function validateOfferVersionSnapshot(
  snapshot: OfferVersionSnapshot,
): OfferVersionSnapshotValidation {
  const issues: string[] = [];
  if (!snapshot.offerId) issues.push('Angebots-ID fehlt.');
  if (!snapshot.offerNumber) issues.push('Angebotsnummer fehlt.');
  if (!snapshot.versionNumber || snapshot.versionNumber < 1) issues.push('Versionsnummer ist ungültig.');
  if (!snapshot.leadId) issues.push('Lead-ID fehlt.');
  if (!snapshot.title.trim()) issues.push('Angebotstitel fehlt.');
  if (snapshot.terminalCount < 0 || snapshot.optionalTerminalCount < 0) {
    issues.push('Terminalanzahl ist ungültig.');
  }
  if (snapshot.terminalLines.some((item) => item.productSnapshot?.category !== 'payment_terminal')) {
    issues.push('Terminalpositionen enthalten ungültige Produkte.');
  }
  if (snapshot.accessoryLines.some((item) => item.productSnapshot?.category !== 'accessory')) {
    issues.push('Zubehörpositionen enthalten ungültige Produkte.');
  }
  return { valid: issues.length === 0, issues };
}
