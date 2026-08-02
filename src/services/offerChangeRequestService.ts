import {
  MAX_CHANGE_REQUEST_LENGTH,
  type OfferChangeRequest,
  type OfferChangeRequestStatus,
} from '../domain/offer/offerChangeRequest';
import { sanitizeCustomerText } from '../domain/offer/offerCustomerQuestion';
import type { OfferChangeRequestRepository } from '../repositories/interfaces/OfferChangeRequestRepository';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import { generateId, nowIso } from '../utils/id';
import type { OfferUserContext } from './offerService';
import type { SalesActivityService } from './salesActivityService';

export interface SubmitChangeRequestInput {
  offerId: string;
  offerVersionId: string;
  shareId: string | null;
  requestText: string;
  customerName?: string | null;
  customerEmail?: string | null;
}

export type SubmitChangeRequestResult =
  | { ok: true; request: OfferChangeRequest }
  | { ok: false; error: 'validation' | 'not_found'; issues?: string[] };

export class OfferChangeRequestService {
  private activityService: SalesActivityService | null = null;
  private readonly changeRequestRepository: OfferChangeRequestRepository;
  private readonly offerRepository: OfferRepository;

  constructor(
    changeRequestRepository: OfferChangeRequestRepository,
    offerRepository: OfferRepository,
  ) {
    this.changeRequestRepository = changeRequestRepository;
    this.offerRepository = offerRepository;
  }

  setSalesActivityService(service: SalesActivityService): void {
    this.activityService = service;
  }

  async getChangeRequestsByOfferId(offerId: string): Promise<OfferChangeRequest[]> {
    return this.changeRequestRepository.getByOfferId(offerId);
  }

  async getOpenChangeRequestsByOfferId(offerId: string): Promise<OfferChangeRequest[]> {
    const requests = await this.changeRequestRepository.getByOfferId(offerId);
    return requests.filter((entry) => entry.status === 'open' || entry.status === 'reviewed');
  }

  validateChangeRequestInput(input: SubmitChangeRequestInput): string[] {
    const text = sanitizeCustomerText(input.requestText);
    const issues: string[] = [];
    if (!text) {
      issues.push('Bitte beschreiben Sie den gewünschten Änderungswunsch.');
    }
    if (text.length > MAX_CHANGE_REQUEST_LENGTH) {
      issues.push(`Der Änderungswunsch darf maximal ${MAX_CHANGE_REQUEST_LENGTH} Zeichen enthalten.`);
    }
    return issues;
  }

  async submitChangeRequest(input: SubmitChangeRequestInput): Promise<SubmitChangeRequestResult> {
    const issues = this.validateChangeRequestInput(input);
    if (issues.length > 0) {
      return { ok: false, error: 'validation', issues };
    }

    const offer = await this.offerRepository.getById(input.offerId);
    if (!offer) {
      return { ok: false, error: 'not_found' };
    }

    const timestamp = nowIso();
    const request: OfferChangeRequest = {
      id: generateId('offer_change'),
      offerId: input.offerId,
      offerVersionId: input.offerVersionId,
      shareId: input.shareId,
      requestText: sanitizeCustomerText(input.requestText),
      customerName: input.customerName?.trim() || null,
      customerEmail: input.customerEmail?.trim() || null,
      status: 'open',
      handledByUserId: null,
      handledAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.changeRequestRepository.create(request);
    await this.recordActivity(null, {
      title: 'Kunde wünscht Änderung',
      description: request.requestText.slice(0, 160),
      offerId: offer.id,
      leadId: offer.leadId,
      sourceKey: `offer_change_requested:${request.id}`,
    });
    return { ok: true, request };
  }

  async updateStatus(
    requestId: string,
    status: OfferChangeRequestStatus,
    context: OfferUserContext,
  ): Promise<{ ok: true; request: OfferChangeRequest } | { ok: false; error: 'not_found' }> {
    const request = await this.changeRequestRepository.getById(requestId);
    if (!request) {
      return { ok: false, error: 'not_found' };
    }
    const timestamp = nowIso();
    const updated: OfferChangeRequest = {
      ...request,
      status,
      handledByUserId: context.userId,
      handledAt: timestamp,
      updatedAt: timestamp,
    };
    await this.changeRequestRepository.update(updated);

    const offer = await this.offerRepository.getById(request.offerId);
    if (status === 'completed') {
      await this.recordActivity(context, {
        title: 'Änderungswunsch erledigt',
        description: 'Ein Kundenänderungswunsch wurde als erledigt markiert.',
        offerId: request.offerId,
        leadId: offer?.leadId ?? null,
        sourceKey: `offer_change_completed:${request.id}`,
      });
    }

    return { ok: true, request: updated };
  }

  private async recordActivity(
    context: OfferUserContext | null,
    input: {
      title: string;
      description: string;
      offerId: string;
      leadId: string | null;
      sourceKey: string;
    },
  ): Promise<void> {
    if (!this.activityService || !context) return;
    await this.activityService.recordSystemActivity(
      {
        type: 'status_change',
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
