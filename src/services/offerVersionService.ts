import {
  buildOfferVersionHistory,
  getNextOfferVersionNumber,
  type OfferVersionHistoryEntry,
} from '../domain/offer/offerVersionLifecycle';
import type { OfferVersion } from '../domain/offer/offerVersion';
import type { OfferApproval } from '../domain/offer/offerWorkflowEvents';
import type { BestPayHandoffRepository } from '../repositories/interfaces/BestPayHandoffRepository';
import type { OfferCustomerAcceptanceRepository } from '../repositories/interfaces/OfferCustomerAcceptanceRepository';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type { OfferShareRepository } from '../repositories/interfaces/OfferShareRepository';
import type { OfferVersionRepository } from '../repositories/interfaces/OfferVersionRepository';
import type { OfferWorkflowEventRepository } from '../repositories/interfaces/OfferWorkflowEventRepository';

export class OfferVersionService {
  private readonly offerRepository: OfferRepository;
  private readonly versionRepository: OfferVersionRepository;
  private readonly eventRepository: OfferWorkflowEventRepository;
  private readonly shareRepository: OfferShareRepository;
  private readonly acceptanceRepository: OfferCustomerAcceptanceRepository;
  private readonly handoffRepository: BestPayHandoffRepository;

  constructor(
    offerRepository: OfferRepository,
    versionRepository: OfferVersionRepository,
    eventRepository: OfferWorkflowEventRepository,
    shareRepository: OfferShareRepository,
    acceptanceRepository: OfferCustomerAcceptanceRepository,
    handoffRepository: BestPayHandoffRepository,
  ) {
    this.offerRepository = offerRepository;
    this.versionRepository = versionRepository;
    this.eventRepository = eventRepository;
    this.shareRepository = shareRepository;
    this.acceptanceRepository = acceptanceRepository;
    this.handoffRepository = handoffRepository;
  }

  async getVersions(offerId: string): Promise<OfferVersion[]> {
    return this.versionRepository.getByOfferId(offerId);
  }

  async getVersionById(id: string): Promise<OfferVersion | null> {
    return this.versionRepository.getById(id);
  }

  async getCurrentVersion(offerId: string): Promise<OfferVersion | null> {
    const offer = await this.offerRepository.getById(offerId);
    return offer?.currentVersionId ? this.versionRepository.getById(offer.currentVersionId) : null;
  }

  async getNextVersionNumber(offerId: string): Promise<number> {
    const versions = await this.getVersions(offerId);
    return getNextOfferVersionNumber(versions);
  }

  async buildVersionHistory(offerId: string): Promise<OfferVersionHistoryEntry[]> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer) {
      return [];
    }

    const [versions, events, shares, acceptances, handoffs] = await Promise.all([
      this.versionRepository.getByOfferId(offerId),
      this.eventRepository.getByOfferId(offerId),
      this.shareRepository.getByOfferId(offerId),
      this.acceptanceRepository.getByOfferId(offerId),
      this.handoffRepository.getByOfferId(offerId),
    ]);

    const approvals = events.filter((entry): entry is OfferApproval => entry.type === 'approval');

    return buildOfferVersionHistory(
      versions,
      offer.currentVersionId,
      approvals,
      shares,
      acceptances,
      handoffs,
    );
  }
}
