import {
  isCustomerAcceptanceComplete,
  type OfferCustomerAcceptance,
  type OfferCustomerAcceptanceCheckboxes,
  validateCustomerAcceptanceCheckboxes,
} from '../domain/offer/offerCustomerAcceptance';
import type { OfferCustomerAcceptanceRepository } from '../repositories/interfaces/OfferCustomerAcceptanceRepository';
import type { OfferVersionRepository } from '../repositories/interfaces/OfferVersionRepository';
import { generateId, nowIso } from '../utils/id';

export interface PrepareOfferAcceptanceInput {
  offerId: string;
  offerVersionId: string;
  acceptorName: string;
  checkboxes: OfferCustomerAcceptanceCheckboxes;
  comment?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  shareId?: string | null;
  acceptedAt?: string;
}

export type PrepareOfferAcceptanceResult =
  | { ok: true; acceptance: OfferCustomerAcceptance }
  | { ok: false; error: 'not_found' | 'validation' | 'already_exists'; issues?: string[] };

export class OfferAcceptanceService {
  private readonly acceptanceRepository: OfferCustomerAcceptanceRepository;
  private readonly versionRepository: OfferVersionRepository;

  constructor(
    acceptanceRepository: OfferCustomerAcceptanceRepository,
    versionRepository: OfferVersionRepository,
  ) {
    this.acceptanceRepository = acceptanceRepository;
    this.versionRepository = versionRepository;
  }

  async getAcceptancesByOfferId(offerId: string): Promise<OfferCustomerAcceptance[]> {
    return this.acceptanceRepository.getByOfferId(offerId);
  }

  async getAcceptanceByVersionId(offerVersionId: string): Promise<OfferCustomerAcceptance | null> {
    return this.acceptanceRepository.getByOfferVersionId(offerVersionId);
  }

  async prepareAcceptance(input: PrepareOfferAcceptanceInput): Promise<PrepareOfferAcceptanceResult> {
    const version = await this.versionRepository.getById(input.offerVersionId);
    if (!version || version.offerId !== input.offerId) {
      return { ok: false, error: 'not_found' };
    }

    const existing = await this.acceptanceRepository.getByOfferVersionId(input.offerVersionId);
    if (existing) {
      return { ok: false, error: 'already_exists' };
    }

    const checkboxIssues = validateCustomerAcceptanceCheckboxes(input.checkboxes);
    if (checkboxIssues.length > 0) {
      return { ok: false, error: 'validation', issues: checkboxIssues };
    }
    if (!input.acceptorName.trim()) {
      return { ok: false, error: 'validation', issues: ['Name des Bestätigenden fehlt.'] };
    }

    const timestamp = nowIso();
    const acceptance: OfferCustomerAcceptance = {
      id: generateId('offer_acceptance'),
      offerId: input.offerId,
      offerVersionId: input.offerVersionId,
      acceptorName: input.acceptorName.trim(),
      acceptedAt: input.acceptedAt ?? timestamp,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      checkboxes: input.checkboxes,
      comment: input.comment?.trim() ?? '',
      shareId: input.shareId ?? null,
      createdAt: timestamp,
    };

    if (!isCustomerAcceptanceComplete(acceptance)) {
      return { ok: false, error: 'validation', issues: ['Annahme unvollständig.'] };
    }

    await this.acceptanceRepository.create(acceptance);
    return { ok: true, acceptance };
  }
}
