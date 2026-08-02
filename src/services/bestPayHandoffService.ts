import type { BestPayHandoff, BestPayHandoffStatus } from '../domain/offer/bestPayHandoff';
import { isTerminalHandoffStatus } from '../domain/offer/bestPayHandoff';
import type { BestPayHandoffRepository } from '../repositories/interfaces/BestPayHandoffRepository';
import type { OfferCustomerAcceptanceRepository } from '../repositories/interfaces/OfferCustomerAcceptanceRepository';
import type { OfferVersionRepository } from '../repositories/interfaces/OfferVersionRepository';
import { generateId, nowIso } from '../utils/id';

export interface PrepareBestPayHandoffInput {
  offerId: string;
  offerVersionId: string;
  acceptanceId?: string | null;
  bestPayReference?: string | null;
  note?: string;
  createdByUserId: string;
}

export type PrepareBestPayHandoffResult =
  | { ok: true; handoff: BestPayHandoff }
  | { ok: false; error: 'not_found' | 'validation' | 'already_exists' };

export type UpdateBestPayHandoffStatusResult =
  | { ok: true; handoff: BestPayHandoff }
  | { ok: false; error: 'not_found' | 'validation' };

const ALLOWED_TRANSITIONS: Partial<Record<BestPayHandoffStatus, BestPayHandoffStatus[]>> = {
  handed_over: ['submitted', 'error', 'rejected'],
  submitted: ['accepted', 'rejected', 'error'],
  error: ['handed_over', 'submitted'],
};

export class BestPayHandoffService {
  private readonly handoffRepository: BestPayHandoffRepository;
  private readonly versionRepository: OfferVersionRepository;
  private readonly acceptanceRepository: OfferCustomerAcceptanceRepository;

  constructor(
    handoffRepository: BestPayHandoffRepository,
    versionRepository: OfferVersionRepository,
    acceptanceRepository: OfferCustomerAcceptanceRepository,
  ) {
    this.handoffRepository = handoffRepository;
    this.versionRepository = versionRepository;
    this.acceptanceRepository = acceptanceRepository;
  }

  async getHandoffsByOfferId(offerId: string): Promise<BestPayHandoff[]> {
    return this.handoffRepository.getByOfferId(offerId);
  }

  async getHandoffByVersionId(offerVersionId: string): Promise<BestPayHandoff | null> {
    return this.handoffRepository.getByOfferVersionId(offerVersionId);
  }

  async prepareHandoff(input: PrepareBestPayHandoffInput): Promise<PrepareBestPayHandoffResult> {
    const version = await this.versionRepository.getById(input.offerVersionId);
    if (!version || version.offerId !== input.offerId) {
      return { ok: false, error: 'not_found' };
    }

    const existing = await this.handoffRepository.getByOfferVersionId(input.offerVersionId);
    if (existing) {
      return { ok: false, error: 'already_exists' };
    }

    if (input.acceptanceId) {
      const acceptance = await this.acceptanceRepository.getById(input.acceptanceId);
      if (!acceptance || acceptance.offerVersionId !== input.offerVersionId) {
        return { ok: false, error: 'validation' };
      }
    }

    const timestamp = nowIso();
    const handoff: BestPayHandoff = {
      id: generateId('bestpay_handoff'),
      offerId: input.offerId,
      offerVersionId: input.offerVersionId,
      acceptanceId: input.acceptanceId ?? null,
      bestPayReference: input.bestPayReference?.trim() || null,
      status: 'handed_over',
      note: input.note?.trim() ?? '',
      createdAt: timestamp,
      createdByUserId: input.createdByUserId,
      updatedAt: timestamp,
    };

    await this.handoffRepository.create(handoff);
    return { ok: true, handoff };
  }

  async updateStatus(
    handoffId: string,
    status: BestPayHandoffStatus,
    note?: string,
  ): Promise<UpdateBestPayHandoffStatusResult> {
    const handoff = await this.handoffRepository.getById(handoffId);
    if (!handoff) {
      return { ok: false, error: 'not_found' };
    }
    if (isTerminalHandoffStatus(handoff.status) && handoff.status !== status) {
      return { ok: false, error: 'validation' };
    }
    const allowed = ALLOWED_TRANSITIONS[handoff.status];
    if (allowed && !allowed.includes(status) && handoff.status !== status) {
      return { ok: false, error: 'validation' };
    }

    const updated: BestPayHandoff = {
      ...handoff,
      status,
      note: note !== undefined ? note.trim() : handoff.note,
      updatedAt: nowIso(),
    };
    await this.handoffRepository.update(updated);
    return { ok: true, handoff: updated };
  }
}
