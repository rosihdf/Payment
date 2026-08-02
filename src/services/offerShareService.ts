import type { OfferPublicationReadiness } from '../domain/offer/offerPublicationReadiness';
import type { OfferShare, ShareStatus } from '../domain/offer/offerShare';
import { deriveShareStatus, isShareAccessible } from '../domain/offer/offerShare';
import { generateShareToken, hashShareToken } from '../domain/offer/shareToken';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type { OfferShareRepository } from '../repositories/interfaces/OfferShareRepository';
import type { OfferVersionRepository } from '../repositories/interfaces/OfferVersionRepository';
import { generateId, nowIso } from '../utils/id';
import type { OfferUserContext } from './offerService';
import type { SalesActivityService } from './salesActivityService';

export interface PrepareOfferShareInput {
  offerId: string;
  offerVersionId: string;
  createdByUserId: string;
  validFrom?: string;
  validUntil: string;
}

export type PrepareOfferShareResult =
  | { ok: true; share: OfferShare; token: string }
  | { ok: false; error: 'not_found' | 'validation' | 'not_ready' | 'stale_version'; blockers?: string[] };

export const DEFAULT_SHARE_VALIDITY_DAYS = 30;

export function defaultShareValidUntil(from: string = nowIso()): string {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() + DEFAULT_SHARE_VALIDITY_DAYS);
  return date.toISOString();
}

export function buildOfferReviewUrl(token: string, origin = window.location.origin): string {
  return `${origin.replace(/\/$/, '')}/offer-review/${token}`;
}

export class OfferShareService {
  private activityService: SalesActivityService | null = null;
  private readonly shareRepository: OfferShareRepository;
  private readonly versionRepository: OfferVersionRepository;
  private readonly offerRepository: OfferRepository;

  constructor(
    shareRepository: OfferShareRepository,
    versionRepository: OfferVersionRepository,
    offerRepository: OfferRepository,
  ) {
    this.shareRepository = shareRepository;
    this.versionRepository = versionRepository;
    this.offerRepository = offerRepository;
  }

  setSalesActivityService(service: SalesActivityService): void {
    this.activityService = service;
  }

  async getSharesByOfferId(offerId: string): Promise<OfferShare[]> {
    return this.shareRepository.getByOfferId(offerId);
  }

  async getActiveShareByOfferId(offerId: string): Promise<OfferShare | null> {
    return this.shareRepository.getActiveByOfferId(offerId);
  }

  async getShareById(id: string): Promise<OfferShare | null> {
    return this.shareRepository.getById(id);
  }

  async getSharesByVersionId(offerVersionId: string): Promise<OfferShare[]> {
    return this.shareRepository.getByOfferVersionId(offerVersionId);
  }

  async createCustomerShareLink(
    offerId: string,
    context: OfferUserContext,
    readiness: OfferPublicationReadiness | null,
  ): Promise<PrepareOfferShareResult> {
    if (!readiness?.publicationAllowed) {
      return {
        ok: false,
        error: 'not_ready',
        blockers: readiness?.blockers ?? ['Kundenvorlage ist nicht freigegeben.'],
      };
    }

    const offer = await this.offerRepository.getById(offerId);
    if (!offer?.currentVersionId) {
      return { ok: false, error: 'not_found' };
    }

    const version = await this.versionRepository.getById(offer.currentVersionId);
    if (!version || version.offerId !== offerId || version.supersededAt) {
      return { ok: false, error: 'stale_version' };
    }

    if (readiness.currentVersionId !== version.id) {
      return { ok: false, error: 'stale_version' };
    }

    const active = await this.shareRepository.getActiveByOfferId(offerId);
    if (active) {
      await this.shareRepository.update({
        ...active,
        status: 'superseded',
        supersededAt: nowIso(),
      });
      await this.recordActivity(context, {
        type: 'status_change',
        title: 'Kundenlink ersetzt',
        description: `Ein neuer Kundenlink ersetzt den bisherigen Link für Angebot ${offer.offerNumber}.`,
        offerId,
        leadId: offer.leadId,
        sourceKey: `offer_share_superseded:${active.id}`,
      });
    }

    const token = generateShareToken();
    const tokenHash = await hashShareToken(token);
    const timestamp = nowIso();
    const share: OfferShare = {
      id: generateId('offer_share'),
      offerId,
      offerVersionId: version.id,
      tokenHash,
      status: 'active',
      validFrom: timestamp,
      validUntil: defaultShareValidUntil(timestamp),
      accessCount: 0,
      lastAccessAt: null,
      createdAt: timestamp,
      createdByUserId: context.userId,
      revokedAt: null,
      revokedByUserId: null,
      supersededAt: null,
    };

    await this.shareRepository.create(share);
    await this.recordActivity(context, {
      type: 'offer_sent',
      title: 'Kundenlink erstellt',
      description: `Angebot ${offer.offerNumber} (Version ${version.versionNumber}) wurde für die Kundenprüfung bereitgestellt.`,
      offerId,
      leadId: offer.leadId,
      sourceKey: `offer_share_created:${share.id}`,
    });

    return { ok: true, share, token };
  }

  async revokeShare(
    shareId: string,
    context: OfferUserContext,
  ): Promise<{ ok: true; share: OfferShare } | { ok: false; error: 'not_found' }> {
    const share = await this.shareRepository.getById(shareId);
    if (!share) {
      return { ok: false, error: 'not_found' };
    }
    const updated: OfferShare = {
      ...share,
      status: 'revoked',
      revokedAt: nowIso(),
      revokedByUserId: context.userId,
    };
    await this.shareRepository.update(updated);
    const offer = await this.offerRepository.getById(share.offerId);
    await this.recordActivity(context, {
      type: 'status_change',
      title: 'Kundenlink widerrufen',
      description: 'Der Kundenlink wurde widerrufen und ist nicht mehr gültig.',
      offerId: share.offerId,
      leadId: offer?.leadId ?? null,
      sourceKey: `offer_share_revoked:${share.id}`,
    });
    return { ok: true, share: updated };
  }

  async markSuperseded(shareId: string): Promise<{ ok: true; share: OfferShare } | { ok: false; error: 'not_found' }> {
    const share = await this.shareRepository.getById(shareId);
    if (!share) {
      return { ok: false, error: 'not_found' };
    }
    const updated: OfferShare = {
      ...share,
      status: 'superseded',
      supersededAt: nowIso(),
    };
    await this.shareRepository.update(updated);
    return { ok: true, share: updated };
  }

  resolveShareStatus(share: OfferShare, at: string = nowIso()): ShareStatus {
    return deriveShareStatus(share, at);
  }

  isAccessible(share: OfferShare, at: string = nowIso()): boolean {
    return isShareAccessible(share, at);
  }

  private async recordActivity(
    context: OfferUserContext,
    input: {
      type: 'offer_sent' | 'status_change';
      title: string;
      description: string;
      offerId: string;
      leadId: string | null;
      sourceKey: string;
    },
  ): Promise<void> {
    if (!this.activityService) return;
    await this.activityService.recordSystemActivity(
      {
        type: input.type,
        title: input.title,
        description: input.description,
        offerId: input.offerId,
        leadId: input.leadId,
        sourceKey: input.sourceKey,
      },
      context,
    );
  }
}
