import type { OfferShare, ShareStatus } from '../domain/offer/offerShare';
import { deriveShareStatus, isShareAccessible } from '../domain/offer/offerShare';
import { generateShareToken, hashShareToken } from '../domain/offer/shareToken';
import type { OfferShareRepository } from '../repositories/interfaces/OfferShareRepository';
import type { OfferVersionRepository } from '../repositories/interfaces/OfferVersionRepository';
import { generateId, nowIso } from '../utils/id';

export interface PrepareOfferShareInput {
  offerId: string;
  offerVersionId: string;
  createdByUserId: string;
  validFrom?: string;
  validUntil: string;
}

export type PrepareOfferShareResult =
  | { ok: true; share: OfferShare; token: string }
  | { ok: false; error: 'not_found' | 'validation' };

const DEFAULT_SHARE_VALIDITY_DAYS = 14;

export function defaultShareValidUntil(from: string = nowIso()): string {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() + DEFAULT_SHARE_VALIDITY_DAYS);
  return date.toISOString();
}

export class OfferShareService {
  private readonly shareRepository: OfferShareRepository;
  private readonly versionRepository: OfferVersionRepository;

  constructor(shareRepository: OfferShareRepository, versionRepository: OfferVersionRepository) {
    this.shareRepository = shareRepository;
    this.versionRepository = versionRepository;
  }

  async getSharesByOfferId(offerId: string): Promise<OfferShare[]> {
    return this.shareRepository.getByOfferId(offerId);
  }

  async getShareById(id: string): Promise<OfferShare | null> {
    return this.shareRepository.getById(id);
  }

  async getSharesByVersionId(offerVersionId: string): Promise<OfferShare[]> {
    return this.shareRepository.getByOfferVersionId(offerVersionId);
  }

  async prepareShare(input: PrepareOfferShareInput): Promise<PrepareOfferShareResult> {
    const version = await this.versionRepository.getById(input.offerVersionId);
    if (!version || version.offerId !== input.offerId) {
      return { ok: false, error: 'not_found' };
    }
    if (version.supersededAt) {
      return { ok: false, error: 'validation' };
    }
    if (!input.validUntil || input.validUntil <= (input.validFrom ?? nowIso())) {
      return { ok: false, error: 'validation' };
    }

    const token = generateShareToken();
    const tokenHash = await hashShareToken(token);
    const timestamp = nowIso();
    const share: OfferShare = {
      id: generateId('offer_share'),
      offerId: input.offerId,
      offerVersionId: input.offerVersionId,
      tokenHash,
      status: 'active',
      validFrom: input.validFrom ?? timestamp,
      validUntil: input.validUntil,
      accessCount: 0,
      lastAccessAt: null,
      createdAt: timestamp,
      createdByUserId: input.createdByUserId,
      revokedAt: null,
      revokedByUserId: null,
    };

    await this.shareRepository.create(share);
    return { ok: true, share, token };
  }

  async revokeShare(
    shareId: string,
    revokedByUserId: string,
  ): Promise<{ ok: true; share: OfferShare } | { ok: false; error: 'not_found' }> {
    const share = await this.shareRepository.getById(shareId);
    if (!share) {
      return { ok: false, error: 'not_found' };
    }
    const updated: OfferShare = {
      ...share,
      status: 'revoked',
      revokedAt: nowIso(),
      revokedByUserId,
    };
    await this.shareRepository.update(updated);
    return { ok: true, share: updated };
  }

  async markSuperseded(shareId: string): Promise<{ ok: true; share: OfferShare } | { ok: false; error: 'not_found' }> {
    const share = await this.shareRepository.getById(shareId);
    if (!share) {
      return { ok: false, error: 'not_found' };
    }
    const updated: OfferShare = { ...share, status: 'superseded' };
    await this.shareRepository.update(updated);
    return { ok: true, share: updated };
  }

  resolveShareStatus(share: OfferShare, at: string = nowIso()): ShareStatus {
    return deriveShareStatus(share, at);
  }

  isAccessible(share: OfferShare, at: string = nowIso()): boolean {
    return isShareAccessible(share, at);
  }
}
