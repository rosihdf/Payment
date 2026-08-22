import { buildOfferVersionSnapshot } from '../domain/offer/buildOfferVersionSnapshot';
import {
  followUpTaskSourceKey,
  legacyFollowUpTaskSourceKeys,
  resolveFollowUpDueAt,
  resolveFollowUpTaskTitle,
  shouldScheduleFollowUpTask,
} from '../domain/sales/salesFollowUpSchedule';
import {
  type CounselingPrincipleFlags,
  emptyCounselingPrincipleFlags,
} from '../domain/offer/counselingConfirmation';
import {
  compareOfferVersions,
  hasCustomerRelevantVersionChanges,
} from '../domain/offer/compareOfferVersions';
import type { OfferFollowUpPreferences } from '../domain/offer/offerFollowUpPreferences';
import type { Offer } from '../domain/offer/offer';
import {
  buildOfferCustomerCommunicationHandoff,
  type OfferCustomerCommunicationHandoff,
} from '../domain/offer/offerCustomerCommunicationHandoff';
import { computeOfferDocumentContentHash } from '../domain/offerDocument/offerDocumentHash';
import {
  buildInternalAcceptanceActivitySourceKey,
  buildInternalAcceptanceEventSourceKey,
  buildInternalDeclineEventSourceKey,
  buildOfferDeliverySourceKey,
  buildOfferSentActivitySourceKey,
  canDeliverOffer,
  findDeclineEventBySourceKey,
  findDeliveryEventBySourceKey,
  isOfferAlreadySent,
  mapDeliveryChannelToDispatch,
  type OfferDeliveryChannel,
} from '../domain/offer/offerWorkflowTransitionCore';
import {
  evaluateOfferPublicationReadiness,
  type OfferPublicationReadiness,
} from '../domain/offer/offerPublicationReadiness';
import type { OfferShareRepository } from '../repositories/interfaces/OfferShareRepository';
import type { OfferDocumentRepository } from '../repositories/interfaces/OfferDocumentRepository';
import type { OfferVersion, OfferVersionDiffEntry } from '../domain/offer/offerVersion';
import {
  applyWorkflowTransition,
  isImmutableWorkflowStatus,
  syncLegacyOfferStatus,
  type OfferWorkflowTransition,
} from '../domain/offer/offerWorkflow';
import { isOfferAcceptanceDuplicate } from '../domain/offer/offerAcceptanceCore';
import {
  OFFER_WORKFLOW_EVENT_SCHEMA_VERSION,
  type OfferAcceptance,
  type OfferActivationChecklist,
  type OfferActivationDeviation,
  type OfferDecline,
  type OfferWorkflowEvent,
} from '../domain/offer/offerWorkflowEvents';
import {
  SALES_DOCUMENT_SCHEMA_VERSION,
  type SalesDocument,
} from '../domain/salesDocument/salesDocument';
import type { CommissionCalculationRepository } from '../repositories/interfaces/CommissionCalculationRepository';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type { OfferVersionRepository } from '../repositories/interfaces/OfferVersionRepository';
import type { OfferWorkflowEventRepository } from '../repositories/interfaces/OfferWorkflowEventRepository';
import type { SalesDocumentRepository } from '../repositories/interfaces/SalesDocumentRepository';
import type { PricingEvaluationRepository } from '../repositories/interfaces/PricingEvaluationRepository';
import {
  validateActivationChecklist,
  validateActivationDeviations,
  validateCounselingPrinciples,
  validateOfferFollowUpPreferences,
  validateStructuredAcceptance,
  validateStructuredDecline,
} from '../domain/offer/offerWorkflowValidation';
import { generateId, nowIso } from '../utils/id';
import type { OfferUserContext } from './offerService';
import type { SalesActivityService } from './salesActivityService';
import { endOfDayIso, type SalesTaskService } from './salesTaskService';

type Result = { ok: true; offer: Offer; duplicate?: boolean } | { ok: false; error: 'not_found' | 'forbidden' | 'invalid_status' | 'validation' | 'contract_failed' };

export interface MarkOfferDeliveredInput {
  offerVersionId: string;
  documentId?: string | null;
  channel: OfferDeliveryChannel;
  recipient?: string;
  shareLinkId?: string | null;
  deliveredAt?: string;
  followUpPreferences?: OfferFollowUpPreferences;
}

export class OfferWorkflowService {
  private activityService: SalesActivityService | null = null;
  private taskService: SalesTaskService | null = null;
  private contractService: import('./contractService').ContractService | null = null;
  private readonly offerRepository: OfferRepository;
  private readonly versionRepository: OfferVersionRepository;
  private readonly eventRepository: OfferWorkflowEventRepository;
  private readonly documentRepository: SalesDocumentRepository;
  private readonly pricingEvaluationRepository: PricingEvaluationRepository;
  private readonly commissionCalculationRepository: CommissionCalculationRepository;
  private offerDocumentRepository: OfferDocumentRepository | null = null;
  private offerShareRepository: OfferShareRepository | null = null;

  constructor(
    offerRepository: OfferRepository,
    versionRepository: OfferVersionRepository,
    eventRepository: OfferWorkflowEventRepository,
    documentRepository: SalesDocumentRepository,
    pricingEvaluationRepository: PricingEvaluationRepository,
    commissionCalculationRepository: CommissionCalculationRepository,
  ) {
    this.offerRepository = offerRepository;
    this.versionRepository = versionRepository;
    this.eventRepository = eventRepository;
    this.documentRepository = documentRepository;
    this.pricingEvaluationRepository = pricingEvaluationRepository;
    this.commissionCalculationRepository = commissionCalculationRepository;
  }

  setSalesTaskService(service: SalesTaskService): void { this.taskService = service; }
  setSalesActivityService(service: SalesActivityService): void { this.activityService = service; }
  setContractService(service: import('./contractService').ContractService): void { this.contractService = service; }
  setOfferDocumentRepository(repository: OfferDocumentRepository): void {
    this.offerDocumentRepository = repository;
  }
  setOfferShareRepository(repository: OfferShareRepository): void {
    this.offerShareRepository = repository;
  }

  async getVersions(offerId: string): Promise<OfferVersion[]> { return this.versionRepository.getByOfferId(offerId); }
  async getVersionById(id: string): Promise<OfferVersion | null> { return this.versionRepository.getById(id); }
  async getCurrentVersion(offerId: string): Promise<OfferVersion | null> {
    const offer = await this.offerRepository.getById(offerId);
    return offer?.currentVersionId ? this.versionRepository.getById(offer.currentVersionId) : null;
  }

  private async resolveVersionSnapshotRefs(offerId: string): Promise<{
    pricingEvaluationId: string | null;
    commissionReferenceId: string | null;
  }> {
    const [evaluations, commissionCases] = await Promise.all([
      this.pricingEvaluationRepository.getByOfferId(offerId),
      this.commissionCalculationRepository.getCasesByOfferId(offerId),
    ]);
    const evaluation =
      evaluations.find((entry) => entry.status === 'draft' && !entry.result.stale) ??
      evaluations[0] ??
      null;
    return {
      pricingEvaluationId: evaluation?.id ?? null,
      commissionReferenceId: commissionCases[0]?.id ?? null,
    };
  }

  async ensureInitialVersion(offer: Offer): Promise<Offer> {
    const versions = await this.getVersions(offer.id);
    if (versions.length) {
      const current =
        versions.find((entry) => entry.id === offer.currentVersionId) ??
        versions.filter((entry) => entry.supersededAt === null).at(-1) ??
        versions.at(-1)!;
      if (offer.currentVersionId === current.id && offer.currentVersionNumber === current.versionNumber) {
        return offer;
      }
      return this.offerRepository.update({
        ...offer,
        currentVersionId: current.id,
        currentVersionNumber: current.versionNumber,
      });
    }
    const refs = await this.resolveVersionSnapshotRefs(offer.id);
    const version: OfferVersion = {
      id: generateId('offer_version'),
      offerId: offer.id,
      versionNumber: 1,
      workflowStatus: offer.workflowStatus,
      snapshot: buildOfferVersionSnapshot(offer, undefined, 1, refs),
      createdAt: offer.createdAt,
      createdByUserId: offer.createdByUserId,
      createdByDisplayName: offer.createdByDisplayName,
      approvedAt: null,
      approvedByUserId: null,
      sentAt: null,
      acceptedAt: null,
      declinedAt: null,
      activatedAt: null,
      supersededAt: null,
    };
    await this.versionRepository.create(version);
    return this.offerRepository.update({
      ...offer,
      currentVersionNumber: 1,
      currentVersionId: version.id,
    });
  }

  async createNewVersion(offerId: string, reason: string, context?: OfferUserContext): Promise<OfferVersion | null> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer) return null;
    const current = await this.getCurrentVersion(offerId);
    if (current) {
      await this.versionRepository.update({ ...current, supersededAt: nowIso() });
    }
    const approvalRequired = await this.detectApprovalRequired(offerId);
    const deviations = await this.collectApprovalDeviations(offerId);
    const refs = await this.resolveVersionSnapshotRefs(offerId);
    const versionNumber = (current?.versionNumber ?? 0) + 1;
    const snapshot = buildOfferVersionSnapshot(offer, undefined, versionNumber, {
      ...refs,
      approvalRequired,
      approvalReasons: deviations,
    });
    const version: OfferVersion = {
      id: generateId('offer_version'),
      offerId,
      versionNumber,
      workflowStatus: 'draft',
      snapshot,
      createdAt: nowIso(),
      createdByUserId: context?.userId ?? offer.createdByUserId,
      createdByDisplayName: context?.displayName ?? offer.createdByDisplayName,
      approvedAt: null,
      approvedByUserId: null,
      sentAt: null,
      acceptedAt: null,
      declinedAt: null,
      activatedAt: null,
      supersededAt: null,
    };
    await this.versionRepository.create(version);
    // Neue Version invalidiert Angebots-Freigabe-/Versandstatus – alte Freigabe gilt nicht weiter.
    const resetStatus = 'draft' as const;
    const updatedOffer = await this.offerRepository.update({
      ...offer,
      currentVersionNumber: version.versionNumber,
      currentVersionId: version.id,
      workflowStatus: resetStatus,
      status: syncLegacyOfferStatus(resetStatus),
      updatedAt: nowIso(),
    });
    await this.record(
      'status_change',
      'Neue Angebotsversion erstellt',
      reason,
      updatedOffer,
      context,
      `offer_version:${version.id}`,
    );
    return version;
  }

  async detectApprovalRequired(offerId: string): Promise<boolean> {
    const records = await this.pricingEvaluationRepository.getByOfferId(offerId);
    return records.some((record) => record.status === 'draft' && !record.result.stale &&
      (record.result.approval.adminReviewRequired || record.result.approval.approvalBlocked));
  }

  async collectApprovalDeviations(offerId: string): Promise<string[]> {
    const records = await this.pricingEvaluationRepository.getByOfferId(offerId);
    const reasons = new Set<string>();
    for (const record of records) {
      if (record.status !== 'draft' || record.result.stale) continue;
      for (const reason of record.result.approval.reasons ?? []) {
        if (typeof reason === 'string' && reason.trim()) {
          reasons.add(reason.trim());
        }
      }
    }
    return [...reasons];
  }

  async isPricingStale(offerId: string): Promise<boolean> {
    const records = await this.pricingEvaluationRepository.getByOfferId(offerId);
    return records.some((record) => record.status === 'draft' && record.result.stale);
  }

  async hasApprovalForVersion(offerId: string, versionId: string): Promise<boolean> {
    const events = await this.eventRepository.getByOfferId(offerId);
    return events.some((event) => event.type === 'approval' && event.offerVersionId === versionId && event.status === 'approved');
  }

  async hasCounselingConfirmationForVersion(offerId: string, versionId: string): Promise<boolean> {
    const events = await this.eventRepository.getByOfferId(offerId);
    return events.some(
      (event) =>
        event.type === 'counseling_confirmation' &&
        event.offerVersionId === versionId &&
        validateCounselingPrinciples(event.principles) === undefined,
    );
  }

  async evaluatePublicationReadiness(offerId: string): Promise<OfferPublicationReadiness | null> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer) return null;
    const version = await this.getCurrentVersion(offerId);
    const approvalRequired = await this.detectApprovalRequired(offerId);
    const hasApprovalForVersion = version
      ? await this.hasApprovalForVersion(offerId, version.id)
      : false;
    const hasCounselingConfirmation = version
      ? await this.hasCounselingConfirmationForVersion(offerId, version.id)
      : false;
    const pricingStale = await this.isPricingStale(offerId);
    const recommendationStale = Boolean(
      offer.recommendationLink.recommendationRecordId &&
        !offer.recommendationLink.recommendationVersion,
    );
    const deviations = await this.collectApprovalDeviations(offerId);
    const documentContext = await this.resolveDocumentPublicationContext(
      offerId,
      version?.id ?? null,
    );
    return evaluateOfferPublicationReadiness({
      offer,
      version,
      approvalRequired,
      hasApprovalForVersion,
      hasCounselingConfirmation,
      pricingStale,
      recommendationStale,
      deviations,
      currentGeneratedDocument: documentContext.currentGeneratedDocument,
      staleDocumentForOtherVersion: documentContext.staleDocumentForOtherVersion,
    });
  }

  async evaluateCustomerCommunicationHandoff(
    offerId: string,
    shareUrl: string | null = null,
  ): Promise<OfferCustomerCommunicationHandoff | null> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer) return null;
    const readiness = await this.evaluatePublicationReadiness(offerId);
    if (!readiness) return null;
    const [version, activeShare, events] = await Promise.all([
      this.getCurrentVersion(offerId),
      this.offerShareRepository
        ? this.offerShareRepository.getActiveByOfferId(offerId)
        : Promise.resolve(null),
      this.eventRepository.getByOfferId(offerId),
    ]);
    const document = readiness.documentId && this.offerDocumentRepository
      ? await this.offerDocumentRepository.getById(readiness.documentId)
      : null;
    return buildOfferCustomerCommunicationHandoff({
      offer,
      readiness,
      version,
      document,
      activeShare,
      shareUrl,
      workflowEvents: events,
    });
  }

  private async resolveDocumentPublicationContext(
    offerId: string,
    offerVersionId: string | null,
  ): Promise<{
    currentGeneratedDocument: {
      id: string;
      offerVersionId: string;
      integrityValid?: boolean;
    } | null;
    staleDocumentForOtherVersion: boolean;
  }> {
    if (!this.offerDocumentRepository || !offerVersionId) {
      return { currentGeneratedDocument: null, staleDocumentForOtherVersion: false };
    }
    const documents = await this.offerDocumentRepository.getByOfferId(offerId);
    const generated = documents.filter((document) => document.status === 'generated');
    const current = generated.find((document) => document.offerVersionId === offerVersionId);
    const staleDocumentForOtherVersion =
      !current && generated.some((document) => document.offerVersionId !== offerVersionId);

    if (!current) {
      return { currentGeneratedDocument: null, staleDocumentForOtherVersion };
    }

    const { contentHash, ...withoutHash } = current.snapshot;
    const actualHash = await computeOfferDocumentContentHash(withoutHash);
    return {
      currentGeneratedDocument: {
        id: current.id,
        offerVersionId,
        integrityValid: actualHash === contentHash,
      },
      staleDocumentForOtherVersion,
    };
  }

  async getWizardWorkflowView(offerId: string): Promise<{ offer: Offer | null; version: OfferVersion | null; approvalRequired: boolean; approved: boolean; workflowStatus: Offer['workflowStatus'] | null }> {
    const offer = await this.offerRepository.getById(offerId);
    const version = offer ? await this.getCurrentVersion(offerId) : null;
    const approvalRequired = offer ? await this.detectApprovalRequired(offerId) : false;
    const hasVersionApproval = Boolean(
      version && (await this.hasApprovalForVersion(offerId, version.id)),
    );
    // Freigabe gilt nur versionsbezogen – Status allein reicht nicht für eine neue Version.
    const approved = Boolean(
      version &&
        ((!approvalRequired &&
          ['approved', 'ready_to_send', 'sent', 'accepted', 'activation_pending', 'activated', 'released', 'accounted', 'paid'].includes(
            offer!.workflowStatus,
          )) ||
          hasVersionApproval),
    );
    return { offer, version, approvalRequired, approved, workflowStatus: offer?.workflowStatus ?? null };
  }

  resolveWizardStepFromWorkflow(status: Offer['workflowStatus']): 'offer' | 'approval' | 'closing' {
    return ['draft', 'changes_requested'].includes(status) ? 'offer'
      : ['approval_required', 'in_approval'].includes(status) ? 'approval' : 'closing';
  }

  async checkAndMarkExpired(offerId: string, context: OfferUserContext): Promise<Result> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer) return { ok: false, error: 'not_found' };
    if (!offer.validUntil || new Date(offer.validUntil).getTime() >= Date.now()) return { ok: true, offer };
    return this.transition(offerId, 'mark_expired', context);
  }

  async detectRelevantChanges(offerId: string): Promise<OfferVersionDiffEntry[]> {
    const current = await this.getCurrentVersion(offerId);
    const offer = await this.offerRepository.getById(offerId);
    if (!current || !offer) return [];
    return compareOfferVersions(current, { ...current, snapshot: buildOfferVersionSnapshot(offer, undefined, current.versionNumber) });
  }

  async createNewVersionIfNeeded(offerId: string, reason: string, context?: OfferUserContext): Promise<OfferVersion | null> {
    const diffs = await this.detectRelevantChanges(offerId);
    return hasCustomerRelevantVersionChanges(diffs)
      ? this.createNewVersion(offerId, reason, context)
      : this.getCurrentVersion(offerId);
  }

  async syncOfferAfterWizardCreation(offerId: string, sessionId: string, scenarioId: string, context: OfferUserContext): Promise<Offer | null> {
    void context;
    const offer = await this.offerRepository.getById(offerId);
    if (!offer) return null;
    const saved = await this.offerRepository.update({ ...offer, sourceComparisonSessionId: sessionId, sourceScenarioId: scenarioId, updatedAt: nowIso() });
    return this.ensureInitialVersion(saved);
  }

  private async transition(offerId: string, action: OfferWorkflowTransition, context: OfferUserContext): Promise<Result> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer) return { ok: false, error: 'not_found' };
    if (
      context.role !== 'admin' &&
      offer.createdByUserId !== context.userId &&
      action !== 'approve' &&
      action !== 'request_changes'
    ) return { ok: false, error: 'forbidden' };
    const target = applyWorkflowTransition(offer.workflowStatus, action);
    if (!target) return { ok: false, error: 'invalid_status' };
    const timestamp = nowIso();
    const saved = await this.offerRepository.update({
      ...offer, workflowStatus: target, status: syncLegacyOfferStatus(target), updatedAt: timestamp,
      completedAt: target === 'accepted' ? timestamp : offer.completedAt,
      completedByUserId: target === 'accepted' ? context.userId : offer.completedByUserId,
      cancelledAt: target === 'cancelled' ? timestamp : offer.cancelledAt,
      cancelledByUserId: target === 'cancelled' ? context.userId : offer.cancelledByUserId,
    });
    return { ok: true, offer: saved };
  }

  private async event(event: OfferWorkflowEvent): Promise<void> { await this.eventRepository.create(event); }
  private async record(
    type:
      | 'status_change'
      | 'approval_requested'
      | 'approval_completed'
      | 'approval_rejected'
      | 'offer_sent'
      | 'offer_accepted'
      | 'activation'
      | 'commission',
    title: string,
    description: string,
    offer: Offer,
    context: OfferUserContext | undefined,
    sourceKey: string,
  ): Promise<void> {
    if (this.activityService && context) {
      await this.activityService.recordSystemActivity(
        { type, title, description, leadId: offer.leadId, offerId: offer.id, sourceKey },
        context,
      );
    }
  }

  async submitForApproval(offerId: string, context: OfferUserContext, note = ''): Promise<Result> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer) return { ok: false, error: 'not_found' };
    const required = await this.detectApprovalRequired(offerId);
    if (!required && offer.workflowStatus === 'draft') {
      const timestamp = nowIso();
      const saved = await this.offerRepository.update({
        ...offer,
        workflowStatus: 'ready_to_send',
        status: syncLegacyOfferStatus('ready_to_send'),
        updatedAt: timestamp,
      });
      return { ok: true, offer: saved };
    }
    const resubmission = offer.workflowStatus === 'changes_requested';
    const result = await this.transition(offerId, 'submit_for_approval', context);
    if (!result.ok) return result;
    await this.event({ id: generateId('offer_approval'), schemaVersion: OFFER_WORKFLOW_EVENT_SCHEMA_VERSION, type: 'approval', status: 'submitted', offerId, offerVersionId: result.offer.currentVersionId, createdAt: nowIso(), createdByUserId: context.userId, createdByDisplayName: context.displayName, note, requestedByUserId: context.userId, approvedByUserId: null });
    await this.record(
      'approval_requested',
      resubmission ? 'Änderung erneut eingereicht' : 'Angebot wartet auf Freigabe',
      note,
      result.offer,
      context,
      `approval_requested:${offerId}:${result.offer.currentVersionId}`,
    );
    if (this.taskService) await this.taskService.ensureAutomaticTask({ title: 'Angebot freigeben', type: 'review_approval', priority: 'high', dueAt: endOfDayIso(), leadId: result.offer.leadId, offerId, sourceKey: `auto:review_approval:${offerId}` }, context);
    return result;
  }
  async startApproval(offerId: string, context: OfferUserContext): Promise<Result> { return this.transition(offerId, 'start_approval', context); }
  async requestChanges(offerId: string, context: OfferUserContext, note = ''): Promise<Result> {
    const result = await this.transition(offerId, 'request_changes', context);
    if (result.ok) {
      await this.event({ id: generateId('offer_approval'), schemaVersion: 1, type: 'approval', status: 'changes_requested', offerId, offerVersionId: result.offer.currentVersionId, createdAt: nowIso(), createdByUserId: context.userId, createdByDisplayName: context.displayName, note, requestedByUserId: result.offer.createdByUserId, approvedByUserId: null });
      await this.record(
        'approval_rejected',
        'Freigabe abgelehnt',
        note || 'Änderung erforderlich',
        result.offer,
        context,
        `approval_rejected:${offerId}:${result.offer.currentVersionId}`,
      );
    }
    return result;
  }
  async approve(offerId: string, context: OfferUserContext, note = ''): Promise<Result> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer) return { ok: false, error: 'not_found' };
    if (context.role === 'field_service' && offer.createdByUserId === context.userId) return { ok: false, error: 'forbidden' };
    const result = await this.transition(offerId, 'approve', context);
    if (!result.ok) return result;
    await this.event({ id: generateId('offer_approval'), schemaVersion: 1, type: 'approval', status: 'approved', offerId, offerVersionId: result.offer.currentVersionId, createdAt: nowIso(), createdByUserId: context.userId, createdByDisplayName: context.displayName, note, requestedByUserId: offer.createdByUserId, approvedByUserId: context.userId });
    const version = await this.getCurrentVersion(offerId);
    if (version) await this.versionRepository.update({ ...version, workflowStatus: 'approved', approvedAt: nowIso(), approvedByUserId: context.userId });
    await this.record('approval_completed', 'Freigabe erteilt', note, result.offer, context, `approval_completed:${offerId}:${result.offer.currentVersionId}`);
    return result;
  }
  async markReadyToSend(offerId: string, context: OfferUserContext): Promise<Result> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer) {
      return { ok: false, error: 'not_found' };
    }
    const readiness = await this.evaluatePublicationReadiness(offerId);
    if (!readiness) {
      return { ok: false, error: 'not_found' };
    }
    if (offer.workflowStatus !== 'approved' || !readiness.readyForCustomerTemplate) {
      return { ok: false, error: 'validation' };
    }
    return this.transition(offerId, 'mark_ready_to_send', context);
  }

  async confirmCounselingPrinciples(
    offerId: string,
    versionId: string,
    context: OfferUserContext,
    flags: CounselingPrincipleFlags = emptyCounselingPrincipleFlags(),
  ): Promise<Result> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer) {
      return { ok: false, error: 'not_found' };
    }
    if (offer.currentVersionId !== versionId) {
      return { ok: false, error: 'validation' };
    }
    const validationError = validateCounselingPrinciples(flags);
    if (validationError) {
      return { ok: false, error: 'validation' };
    }
    const existing = await this.eventRepository.getByOfferId(offerId);
    const duplicate = existing.find(
      (event) => event.type === 'counseling_confirmation' && event.offerVersionId === versionId,
    );
    if (duplicate) {
      return { ok: true, offer };
    }
    await this.event({
      id: generateId('offer_counseling'),
      schemaVersion: OFFER_WORKFLOW_EVENT_SCHEMA_VERSION,
      type: 'counseling_confirmation',
      offerId,
      offerVersionId: versionId,
      createdAt: nowIso(),
      createdByUserId: context.userId,
      createdByDisplayName: context.displayName,
      note: '',
      confirmedAt: nowIso(),
      principles: flags,
    });
    return { ok: true, offer };
  }

  async recordFollowUpPreferences(
    offerId: string,
    versionId: string,
    context: OfferUserContext,
    preferences: OfferFollowUpPreferences,
  ): Promise<Result> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer) {
      return { ok: false, error: 'not_found' };
    }
    const validationError = validateOfferFollowUpPreferences(preferences);
    if (validationError) {
      return { ok: false, error: 'validation' };
    }
    const existing = await this.eventRepository.getByOfferId(offerId);
    const duplicate = existing.find(
      (event) => event.type === 'follow_up_preferences' && event.offerVersionId === versionId,
    );
    if (duplicate) {
      return { ok: true, offer };
    }
    await this.event({
      id: generateId('offer_follow_up'),
      schemaVersion: OFFER_WORKFLOW_EVENT_SCHEMA_VERSION,
      type: 'follow_up_preferences',
      offerId,
      offerVersionId: versionId,
      createdAt: nowIso(),
      createdByUserId: context.userId,
      createdByDisplayName: context.displayName,
      note: '',
      preferences,
    });
    return { ok: true, offer };
  }

  async markOfferDeliveredToCustomer(
    offerId: string,
    context: OfferUserContext,
    input: MarkOfferDeliveredInput,
  ): Promise<Result> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer?.currentVersionId) {
      return { ok: false, error: 'not_found' };
    }
    if (offer.currentVersionId !== input.offerVersionId) {
      return { ok: false, error: 'validation' };
    }

    const deliverySourceKey = buildOfferDeliverySourceKey({
      offerId,
      offerVersionId: input.offerVersionId,
      channel: input.channel,
      shareLinkId: input.shareLinkId,
    });
    const events = await this.eventRepository.getByOfferId(offerId);
    if (findDeliveryEventBySourceKey(events, deliverySourceKey)) {
      const refreshed = await this.offerRepository.getById(offerId);
      return { ok: true, offer: refreshed ?? offer, duplicate: true };
    }

    const alreadySent = isOfferAlreadySent(offer.workflowStatus);
    const readiness = await this.evaluatePublicationReadiness(offerId);
    if (!alreadySent) {
      if (!readiness?.sendAllowed) {
        return { ok: false, error: 'validation' };
      }
      if (!canDeliverOffer(offer.workflowStatus)) {
        return { ok: false, error: 'invalid_status' };
      }
    } else if (offer.workflowStatus !== 'sent') {
      return { ok: false, error: 'invalid_status' };
    }

    if (input.followUpPreferences) {
      const followUpResult = await this.recordFollowUpPreferences(
        offerId,
        input.offerVersionId,
        context,
        input.followUpPreferences,
      );
      if (!followUpResult.ok) {
        return followUpResult;
      }
    }

    let savedOffer = offer;
    const sentAt = input.deliveredAt ?? nowIso();
    if (!alreadySent) {
      const result = await this.transition(offerId, 'document_sent', context);
      if (!result.ok) return result;
      savedOffer = result.offer;
      const version = await this.getCurrentVersion(offerId);
      if (version) {
        await this.versionRepository.update({
          ...version,
          workflowStatus: 'sent',
          sentAt,
        });
      }
    }

    await this.event({
      id: deliverySourceKey.replace(/:/g, '_'),
      schemaVersion: 1,
      type: 'dispatch',
      offerId,
      offerVersionId: input.offerVersionId,
      createdAt: sentAt,
      createdByUserId: context.userId,
      createdByDisplayName: context.displayName,
      note: deliverySourceKey,
      channel: mapDeliveryChannelToDispatch(input.channel),
      recipient: input.recipient?.trim() || input.shareLinkId || '',
      sentAt,
    });

    await this.record(
      'offer_sent',
      'Angebot an Kunden übergeben',
      input.recipient?.trim() || '',
      savedOffer,
      context,
      buildOfferSentActivitySourceKey(offerId, input.offerVersionId),
    );

    if (
      this.taskService &&
      input.followUpPreferences &&
      shouldScheduleFollowUpTask(input.followUpPreferences) &&
      !alreadySent
    ) {
      await this.reconcileFollowUpOfferTask(
        offerId,
        savedOffer.leadId,
        input.followUpPreferences,
        context,
      );
    }

    const refreshed = await this.offerRepository.getById(offerId);
    return { ok: true, offer: refreshed ?? savedOffer };
  }

  async documentSent(
    offerId: string,
    context: OfferUserContext,
    recipient = '',
    channel: 'email' | 'portal' | 'manual' = 'email',
    followUpPreferences?: OfferFollowUpPreferences,
  ): Promise<Result> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer?.currentVersionId) {
      return { ok: false, error: 'not_found' };
    }
    const readiness = await this.evaluatePublicationReadiness(offerId);
    const mappedChannel: OfferDeliveryChannel =
      channel === 'portal' ? 'share_link' : 'manual';
    return this.markOfferDeliveredToCustomer(offerId, context, {
      offerVersionId: offer.currentVersionId,
      documentId: readiness?.documentId ?? null,
      channel: mappedChannel,
      recipient,
      followUpPreferences,
    });
  }

  private async reconcileFollowUpOfferTask(
    offerId: string,
    leadId: string | null,
    preferences: OfferFollowUpPreferences,
    context: OfferUserContext,
  ): Promise<void> {
    if (!this.taskService) {
      return;
    }
    const openTasks = (await this.taskService.listVisible(context)).filter(
      (task) =>
        task.offerId === offerId &&
        task.type === 'follow_up_offer' &&
        (task.status === 'open' || task.status === 'in_progress'),
    );
    const canonicalKey = followUpTaskSourceKey(offerId);
    const legacyKeys = new Set(legacyFollowUpTaskSourceKeys(offerId));
    for (const task of openTasks) {
      if (task.sourceKey && legacyKeys.has(task.sourceKey)) {
        await this.taskService.cancelTask(task.id, context);
      }
    }
    await this.taskService.ensureOrUpdateAutomaticTask(
      {
        title: resolveFollowUpTaskTitle(preferences),
        type: 'follow_up_offer',
        priority: 'normal',
        dueAt: resolveFollowUpDueAt(preferences),
        leadId,
        offerId,
        sourceKey: canonicalKey,
      },
      context,
    );
  }
  async acceptOffer(offerId: string, context: OfferUserContext, input: Pick<OfferAcceptance, 'acceptedByName' | 'acceptanceType' | 'otherText' | 'note'> | string = ''): Promise<Result> {
    const acceptance = typeof input === 'string'
      ? { acceptedByName: input, acceptanceType: 'other' as const, otherText: input.trim() || null, note: '' }
      : input;
    const validationError = validateStructuredAcceptance(acceptance);
    if (validationError) return { ok: false, error: 'validation' };
    const offer = await this.offerRepository.getById(offerId);
    if (!offer?.currentVersionId) return { ok: false, error: 'not_found' };
    const eventSourceKey = buildInternalAcceptanceEventSourceKey(offerId, offer.currentVersionId);
    const events = await this.eventRepository.getByOfferId(offerId);
    if (isOfferAcceptanceDuplicate({
      workflowStatus: offer.workflowStatus,
      events,
      acceptanceEventSourceKey: eventSourceKey,
    })) {
      if (this.contractService) {
        const contractResult = await this.contractService.createFromAcceptedOffer(offerId, {
          userId: context.userId,
          role: context.role,
          displayName: context.displayName,
          status: 'active',
        });
        if (!contractResult.ok && contractResult.error !== 'forbidden') {
          return { ok: false, error: 'contract_failed' };
        }
      }
      return { ok: true, offer, duplicate: true };
    }

    if (!applyWorkflowTransition(offer.workflowStatus, 'accept')) {
      return { ok: false, error: 'invalid_status' };
    }

    if (this.contractService) {
      const contractResult = await this.contractService.createFromAcceptedOffer(offerId, {
        userId: context.userId,
        role: context.role,
        displayName: context.displayName,
        status: 'active',
      });
      if (!contractResult.ok) {
        return { ok: false, error: 'contract_failed' };
      }
    }

    const result = await this.transition(offerId, 'accept', context);
    if (result.ok) {
      await this.event({ id: eventSourceKey.replace(/:/g, '_'), schemaVersion: 1, type: 'acceptance', offerId, offerVersionId: result.offer.currentVersionId, createdAt: nowIso(), createdByUserId: context.userId, createdByDisplayName: context.displayName, note: eventSourceKey, acceptedAt: nowIso(), acceptedByName: acceptance.acceptedByName, acceptanceType: acceptance.acceptanceType, otherText: acceptance.otherText });
      await this.record('offer_accepted', 'Kunde angenommen', acceptance.acceptedByName, result.offer, context, buildInternalAcceptanceActivitySourceKey(offerId, result.offer.currentVersionId!));
    }
    return result;
  }
  async declineOffer(offerId: string, context: OfferUserContext, input: Pick<OfferDecline, 'reason' | 'otherText' | 'note'> | string = ''): Promise<Result> {
    const decline = typeof input === 'string'
      ? { reason: 'other' as const, otherText: input.trim() || null, note: input }
      : input;
    const validationError = validateStructuredDecline(decline);
    if (validationError) return { ok: false, error: 'validation' };
    const offer = await this.offerRepository.getById(offerId);
    if (!offer?.currentVersionId) return { ok: false, error: 'not_found' };
    const eventSourceKey = buildInternalDeclineEventSourceKey(offerId, offer.currentVersionId);
    const events = await this.eventRepository.getByOfferId(offerId);
    if (findDeclineEventBySourceKey(events, eventSourceKey) || offer.workflowStatus === 'declined') {
      return { ok: true, offer, duplicate: true };
    }
    const result = await this.transition(offerId, 'decline', context);
    if (result.ok) {
      await this.event({ id: eventSourceKey.replace(/:/g, '_'), schemaVersion: 1, type: 'decline', offerId, offerVersionId: result.offer.currentVersionId, createdAt: nowIso(), createdByUserId: context.userId, createdByDisplayName: context.displayName, note: eventSourceKey, declinedAt: nowIso(), reason: decline.reason, otherText: decline.otherText });
    }
    return result;
  }
  async markExpired(offerId: string, context: OfferUserContext): Promise<Result> { return this.transition(offerId, 'mark_expired', context); }
  /**
   * Historischer Workflow-Schritt (OfferActivation-Event).
   * Operative Aktivierung erfolgt ausschließlich über ActivationService.startFromContract.
   */
  async prepareActivation(offerId: string, context: OfferUserContext, checklist: OfferActivationChecklist): Promise<Result> {
    const checklistError = validateActivationChecklist(checklist);
    if (checklistError) return { ok: false, error: 'validation' };
    const result = await this.transition(offerId, 'prepare_activation', context);
    if (result.ok) {
      await this.event({ id: generateId('offer_activation'), schemaVersion: 1, type: 'activation', status: 'prepared', offerId, offerVersionId: result.offer.currentVersionId, createdAt: nowIso(), createdByUserId: context.userId, createdByDisplayName: context.displayName, note: '', checklist, activatedAt: null, externalReference: null, deviations: [], activatedHardware: [] });
      if (this.contractService) {
        await this.contractService.syncFromOfferActivation(offerId, {
          userId: context.userId,
          role: context.role,
          displayName: context.displayName,
          status: 'active',
        });
      }
    }
    return result;
  }
  /**
   * Historischer Workflow-Schritt (OfferActivation-Event).
   * Schreibt keine operative ActivationCase-Wahrheit und setzt den Vertrag nicht auf active.
   */
  async activate(offerId: string, context: OfferUserContext, input: { externalReference?: string; note?: string; deviations?: OfferActivationDeviation[]; activatedHardware?: string[] } = {}): Promise<Result> {
    const deviations = input.deviations ?? [];
    const deviationError = validateActivationDeviations(deviations);
    if (deviationError) return { ok: false, error: 'validation' };
    const result = await this.transition(offerId, 'activate', context);
    if (result.ok) {
      await this.event({ id: generateId('offer_activation'), schemaVersion: 1, type: 'activation', status: 'activated', offerId, offerVersionId: result.offer.currentVersionId, createdAt: nowIso(), createdByUserId: context.userId, createdByDisplayName: context.displayName, note: input.note ?? '', checklist: { offerVersionId: result.offer.currentVersionId ?? '', checks: {} }, activatedAt: nowIso(), externalReference: input.externalReference ?? null, deviations, activatedHardware: input.activatedHardware ?? [] });
      await this.record('activation', 'Historische Angebotsaktivierung dokumentiert', input.note ?? '', result.offer, context, `activation:${offerId}`);
      if (this.contractService) {
        await this.contractService.syncFromOfferActivation(offerId, {
          userId: context.userId,
          role: context.role,
          displayName: context.displayName,
          status: 'active',
        });
      }
    }
    return result;
  }
  async syncFromCommissionCase(offerId: string, context: OfferUserContext): Promise<Result> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer) {
      return { ok: false, error: 'not_found' };
    }
    const cases = await this.commissionCalculationRepository.getCasesByOfferId(offerId);
    const status = cases[0]?.status;
    const action =
      status === 'released'
        ? 'mark_released'
        : status === 'settled'
          ? 'mark_accounted'
          : status === 'paid'
            ? 'mark_paid'
            : null;
    return action ? this.transition(offerId, action, context) : { ok: true, offer };
  }
  async cancelWorkflow(offerId: string, context: OfferUserContext): Promise<Result> { return this.transition(offerId, 'cancel', context); }
  async compareVersions(beforeId: string, afterId: string): Promise<OfferVersionDiffEntry[]> { const [before, after] = await Promise.all([this.getVersionById(beforeId), this.getVersionById(afterId)]); return before && after ? compareOfferVersions(before, after) : []; }
  async listDocuments(offerId: string): Promise<SalesDocument[]> { return this.documentRepository.getByOfferId(offerId); }
  async registerDocument(
    offerId: string,
    input: Partial<Omit<SalesDocument, 'id' | 'schemaVersion' | 'offerId' | 'createdAt' | 'createdByUserId' | 'createdByDisplayName'>> &
      Pick<SalesDocument, 'type' | 'fileName' | 'mimeType'>,
    context: OfferUserContext,
  ): Promise<SalesDocument> {
    const document: SalesDocument = {
      id: generateId('sales_document'),
      schemaVersion: SALES_DOCUMENT_SCHEMA_VERSION,
      offerId,
      offerVersionId: input.offerVersionId ?? null,
      contractId: input.contractId ?? null,
      contractVersionId: input.contractVersionId ?? null,
      terminationId: input.terminationId ?? null,
      activationId: input.activationId ?? null,
      type: input.type,
      fileName: input.fileName,
      mimeType: input.mimeType,
      externalReference: input.externalReference ?? null,
      checksum: input.checksum ?? null,
      createdAt: nowIso(),
      createdByUserId: context.userId,
      createdByDisplayName: context.displayName,
    };
    return this.documentRepository.create(document);
  }
  async getWorkflowSummary(offerId: string): Promise<{ offer: Offer | null; currentVersion: OfferVersion | null; events: OfferWorkflowEvent[]; documents: SalesDocument[]; immutable: boolean }> {
    const offer = await this.offerRepository.getById(offerId);
    return { offer, currentVersion: offer ? await this.getCurrentVersion(offerId) : null, events: await this.eventRepository.getByOfferId(offerId), documents: await this.listDocuments(offerId), immutable: Boolean(offer && isImmutableWorkflowStatus(offer.workflowStatus)) };
  }
}
