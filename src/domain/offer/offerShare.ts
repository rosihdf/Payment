/**
 * Share-Link-Domainmodell – Phase 1B Block 1.
 * Kein öffentlicher Endpunkt in diesem Block; nur Datenmodell + Persistenzvorbereitung.
 */
export type ShareStatus = 'active' | 'expired' | 'revoked' | 'superseded';

export const SHARE_STATUS_LABELS: Record<ShareStatus, string> = {
  active: 'Aktiv',
  expired: 'Abgelaufen',
  revoked: 'Widerrufen',
  superseded: 'Ersetzt',
};

/** Klartext-Token nur bei Erzeugung – Persistenz ausschließlich als Hash. */
export type ShareToken = string;

export interface OfferShare {
  id: string;
  offerId: string;
  offerVersionId: string;
  /** Gebundene Dokumentversion zum Zeitpunkt der Link-Erzeugung. */
  documentId: string | null;
  /** SHA-256-Hash des Share-Tokens – niemals Klartext speichern. */
  tokenHash: string;
  status: ShareStatus;
  validFrom: string;
  validUntil: string;
  accessCount: number;
  lastAccessAt: string | null;
  createdAt: string;
  createdByUserId: string;
  revokedAt: string | null;
  revokedByUserId: string | null;
  supersededAt: string | null;
}

export function isShareAccessible(share: OfferShare, at: string = new Date().toISOString()): boolean {
  if (share.status !== 'active') {
    return false;
  }
  if (at < share.validFrom) {
    return false;
  }
  return at <= share.validUntil;
}

export function deriveShareStatus(
  share: OfferShare,
  at: string = new Date().toISOString(),
): ShareStatus {
  if (share.status === 'revoked' || share.status === 'superseded') {
    return share.status;
  }
  if (at > share.validUntil) {
    return 'expired';
  }
  return share.status;
}
