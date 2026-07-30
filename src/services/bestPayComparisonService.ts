import type {
  BestPayComparisonSession,
  BestPayManualInput,
} from '../domain/bestPayComparison/bestPayComparisonSession';
import { createBestPayComparisonSession, mergeManualInput } from '../domain/bestPayComparison/createBestPayComparisonSession';
import { buildCustomerNeedForComparison } from '../domain/bestPayComparison/buildCustomerNeedForComparison';
import {
  resolveCurrentMonthlyCosts,
  summarizeComparisonVariant,
  summarizePrimaryCandidate,
} from '../domain/bestPayComparison/comparisonSummary';
import type { CustomerCostBaseline } from '../domain/billingImport/customerCostBaseline';
import type { User } from '../domain/user/user';
import { nowIso } from '../utils/id';
import type { LeadRepository } from '../repositories/interfaces/LeadRepository';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type { BillingImportService } from './billingImportService';
import type { RecommendationService } from './recommendationService';
import type { OfferService, OfferUserContext } from './offerService';
import {
  readBestPayComparisonSessions,
  saveBestPayComparisonSession,
  migrateBestPayComparisonStorageIfNeeded,
} from './bestPayComparisonStorageMigration';
import type { CreateOfferInput } from '../domain/offer/offer';
import { generateId } from '../utils/id';

export interface BestPayComparisonUserContext {
  userId: string;
  role: User['role'];
  displayName?: string;
}

export type BestPayComparisonError =
  | 'not_found'
  | 'forbidden'
  | 'baseline_required'
  | 'incomplete_input'
  | 'calculation_failed'
  | 'lead_required'
  | 'stale'
  | 'offer_exists'
  | 'validation';

export class BestPayComparisonService {
  private readonly billingImportService: BillingImportService;
  private readonly recommendationService: RecommendationService;
  private readonly offerService: OfferService;
  private readonly leadRepository: LeadRepository;
  private readonly offerRepository: OfferRepository;

  constructor(
    billingImportService: BillingImportService,
    recommendationService: RecommendationService,
    offerService: OfferService,
    leadRepository: LeadRepository,
    offerRepository: OfferRepository,
  ) {
    this.billingImportService = billingImportService;
    this.recommendationService = recommendationService;
    this.offerService = offerService;
    this.leadRepository = leadRepository;
    this.offerRepository = offerRepository;
  }

  private ensureMigrated(): void {
    migrateBestPayComparisonStorageIfNeeded();
  }

  private canAccess(session: BestPayComparisonSession, context: BestPayComparisonUserContext): boolean {
    if (context.role === 'admin') {
      return true;
    }
    return session.createdByUserId === context.userId;
  }

  getActiveDraft(context: BestPayComparisonUserContext): BestPayComparisonSession | null {
    this.ensureMigrated();
    return (
      readBestPayComparisonSessions()
        .filter(
          (session) =>
            this.canAccess(session, context) &&
            session.status !== 'discarded' &&
            session.status !== 'offer_created',
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
    );
  }

  getSession(sessionId: string, context: BestPayComparisonUserContext): BestPayComparisonSession | null {
    this.ensureMigrated();
    const session = readBestPayComparisonSessions().find((entry) => entry.id === sessionId) ?? null;
    if (!session || !this.canAccess(session, context)) {
      return null;
    }
    return session;
  }

  createSession(context: BestPayComparisonUserContext): BestPayComparisonSession {
    this.ensureMigrated();
    const session = createBestPayComparisonSession(context.userId);
    saveBestPayComparisonSession(session);
    return session;
  }

  discardSession(sessionId: string, context: BestPayComparisonUserContext): boolean {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return false;
    }
    session.status = 'discarded';
    session.discardedAt = nowIso();
    session.updatedAt = nowIso();
    saveBestPayComparisonSession(session);
    return true;
  }

  async startBillingImport(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): Promise<{ ok: true; session: BestPayComparisonSession; billingSessionId: string } | { ok: false; error: BestPayComparisonError }> {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }

    const billingSession = await this.billingImportService.getOrCreateFreeSession(context, {
      leadId: session.leadId,
      existingSessionId: session.billingImportSessionId,
    });
    if (!billingSession) {
      return { ok: false, error: 'forbidden' };
    }

    session.billingImportSessionId = billingSession.id;
    session.source = session.source === 'manual' ? 'mixed' : 'billing_import';
    session.status = 'billing_import';
    session.updatedAt = nowIso();
    saveBestPayComparisonSession(session);
    return { ok: true, session, billingSessionId: billingSession.id };
  }

  updateManualInput(
    sessionId: string,
    patch: Partial<BestPayManualInput>,
    context: BestPayComparisonUserContext,
  ): BestPayComparisonSession | null {
    const session = this.getSession(sessionId, context);
    if (!session || session.status === 'offer_created') {
      return null;
    }

    session.manualInput = mergeManualInput(session.manualInput, patch);
    session.source = session.source === 'billing_import' ? 'mixed' : 'manual';
    if (session.status === 'draft' || session.status === 'billing_import') {
      session.status = 'ready_for_calculation';
    }
    if (session.result) {
      session.result.stale = true;
      session.result.staleReasons = ['Manuelle Eingaben wurden geändert.'];
    }
    session.updatedAt = nowIso();
    saveBestPayComparisonSession(session);
    return session;
  }

  async syncBaselineFromBilling(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): Promise<BestPayComparisonSession | null> {
    const session = this.getSession(sessionId, context);
    if (!session?.billingImportSessionId) {
      return session;
    }

    const data = this.billingImportService.getSessionData(session.billingImportSessionId, context);
    const baseline = data?.baseline ?? null;
    if (baseline?.status === 'confirmed') {
      session.costBaselineId = baseline.id;
      session.costBaselineVersion = baseline.version;
      session.status = 'ready_for_calculation';
      session.updatedAt = nowIso();
      saveBestPayComparisonSession(session);
    } else if (data?.session.status === 'review_required') {
      session.status = 'review_required';
      session.updatedAt = nowIso();
      saveBestPayComparisonSession(session);
    }
    return session;
  }

  private resolveBaseline(
    session: BestPayComparisonSession,
    context: BestPayComparisonUserContext,
  ): CustomerCostBaseline | null {
    if (!session.billingImportSessionId) {
      return null;
    }
    const data = this.billingImportService.getSessionData(session.billingImportSessionId, context);
    return data?.baseline?.status === 'confirmed' ? data.baseline : null;
  }

  async calculate(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): Promise<
    | { ok: true; session: BestPayComparisonSession }
    | { ok: false; error: BestPayComparisonError; message?: string }
  > {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }

    await this.syncBaselineFromBilling(sessionId, context);
    const fresh = this.getSession(sessionId, context);
    if (!fresh) {
      return { ok: false, error: 'not_found' };
    }

    const baseline = this.resolveBaseline(fresh, context);
    const hasManualVolume =
      fresh.manualInput.monthlyCardVolumeCents !== null ||
      fresh.manualInput.annualCardVolumeCents !== null;
    if (!baseline && !hasManualVolume) {
      return { ok: false, error: 'incomplete_input', message: 'Bitte Abrechnung bestätigen oder Umsatz manuell erfassen.' };
    }

    const need = buildCustomerNeedForComparison({
      manualInput: fresh.manualInput,
      baseline,
      salesRepresentativeId: context.userId,
      leadId: fresh.leadId,
    });

    const calculation = await this.recommendationService.calculateForStandaloneNeed(need, context);
    if (!calculation.ok) {
      return { ok: false, error: 'calculation_failed' };
    }

    const currentMonthly = resolveCurrentMonthlyCosts(
      baseline,
      fresh.manualInput.monthlyTotalCostsCents,
    );

    const variants = calculation.result.scoredCandidates
      .filter((entry) => entry.candidate.status === 'eligible' || entry.candidate.status === 'limited')
      .slice(0, 5)
      .map((entry) =>
        summarizeComparisonVariant(
          entry,
          currentMonthly,
          calculation.result.primaryCandidate?.candidateId === entry.candidate.candidateId
            ? calculation.result.primaryReasons
            : [],
        ),
      );

    if (calculation.result.primaryCandidate && !variants.some((v) => v.candidateId === calculation.result.primaryCandidate!.candidateId)) {
      variants.unshift(
        summarizePrimaryCandidate(
          calculation.result.primaryCandidate,
          calculation.result.scoredCandidates.find(
            (entry) => entry.candidate.candidateId === calculation.result.primaryCandidate!.candidateId,
          )?.scoreBreakdown.totalScore ?? null,
          currentMonthly,
          calculation.result.primaryReasons,
        ),
      );
    }

    fresh.result = {
      recommendationRecordId: calculation.record.id,
      recommendationVersion: calculation.record.version,
      primaryCandidateId: calculation.result.primaryCandidate?.candidateId ?? null,
      variants,
      currentMonthlyCostsCents: currentMonthly,
      currentAnnualCostsCents: currentMonthly !== null ? currentMonthly * 12 : null,
      inputFingerprint: calculation.result.inputFingerprint,
      calculatedAt: nowIso(),
      stale: false,
      staleReasons: [],
    };
    fresh.selectedCandidateId =
      calculation.result.primaryCandidate?.candidateId ?? variants[0]?.candidateId ?? null;
    fresh.costBaselineId = baseline?.id ?? fresh.costBaselineId;
    fresh.costBaselineVersion = baseline?.version ?? fresh.costBaselineVersion;
    fresh.status = 'calculated';
    fresh.updatedAt = nowIso();
    saveBestPayComparisonSession(fresh);
    return { ok: true, session: fresh };
  }

  selectVariant(
    sessionId: string,
    candidateId: string,
    context: BestPayComparisonUserContext,
  ): BestPayComparisonSession | null {
    const session = this.getSession(sessionId, context);
    if (!session?.result) {
      return null;
    }
    if (!session.result.variants.some((variant) => variant.candidateId === candidateId)) {
      return null;
    }
    session.selectedCandidateId = candidateId;
    session.status = 'recommendation_selected';
    session.updatedAt = nowIso();
    saveBestPayComparisonSession(session);
    return session;
  }

  async assignLead(
    sessionId: string,
    leadId: string,
    context: BestPayComparisonUserContext,
  ): Promise<{ ok: true; session: BestPayComparisonSession } | { ok: false; error: BestPayComparisonError; message?: string }> {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }

    const lead = await this.leadRepository.getById(leadId);
    if (!lead) {
      return { ok: false, error: 'not_found' };
    }

    if (
      context.role !== 'admin' &&
      lead.assignedSalesUserId !== context.userId &&
      lead.createdByUserId !== context.userId
    ) {
      return { ok: false, error: 'forbidden' };
    }

    session.leadId = leadId;
    session.customerLabel = lead.companyName;
    session.status = session.status === 'calculated' || session.status === 'recommendation_selected'
      ? 'assigned'
      : session.status;
    session.updatedAt = nowIso();
    saveBestPayComparisonSession(session);
    return { ok: true, session };
  }

  async createOfferFromComparison(
    sessionId: string,
    context: BestPayComparisonUserContext,
    options: { creationToken?: string; allowStale?: boolean } = {},
  ): Promise<
    | { ok: true; session: BestPayComparisonSession; offerId: string }
    | { ok: false; error: BestPayComparisonError; message?: string }
  > {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    // Idempotent: erneuter Aufruf liefert das bereits erzeugte Angebot zurück.
    if (session.offerId) {
      return { ok: true, session, offerId: session.offerId };
    }
    if (!session.leadId) {
      return { ok: false, error: 'lead_required', message: 'Bitte zuerst einen Lead zuordnen.' };
    }
    if (!session.selectedCandidateId || !session.result) {
      return { ok: false, error: 'validation', message: 'Bitte eine Empfehlung auswählen.' };
    }
    if (session.result.stale && !options.allowStale) {
      return { ok: false, error: 'stale', message: 'Das Ergebnis ist veraltet. Bitte neu berechnen.' };
    }

    const token = options.creationToken ?? generateId('offer_create');
    if (session.offerCreationToken === token) {
      const existing = this.getSession(sessionId, context);
      if (existing?.offerId) {
        return { ok: true, session: existing, offerId: existing.offerId };
      }
    }
    session.offerCreationToken = token;
    session.updatedAt = nowIso();
    saveBestPayComparisonSession(session);

    const variant =
      session.result.variants.find((entry) => entry.candidateId === session.selectedCandidateId) ??
      null;
    if (!variant) {
      return { ok: false, error: 'validation' };
    }

    const input: CreateOfferInput = {
      leadId: session.leadId,
      tariffId: variant.tariffId,
      title: `BestPay-Angebot – ${session.customerLabel ?? 'Händler'}`,
      introductionText: 'Erstellt aus dem BestPay-Vergleichsrechner.',
      internalNotes: `Herkunft: bestpay_calculator; Session: ${session.id}`,
      customerNotes: '',
      validUntil: null,
      items: [],
    };

    const offerContext: OfferUserContext = {
      userId: context.userId,
      role: context.role,
      displayName: context.displayName ?? context.userId,
    };

    const created = await this.offerService.createOffer(input, offerContext);
    if (!created.ok) {
      return { ok: false, error: 'validation', message: 'Angebot konnte nicht erstellt werden.' };
    }

    const offer = await this.offerRepository.getById(created.offer.id);
    if (!offer) {
      return { ok: false, error: 'not_found' };
    }

    await this.offerRepository.update({
      ...offer,
      recommendationLink: {
        ...offer.recommendationLink,
        recommendationRecordId: session.result.recommendationRecordId,
        recommendationVersion: session.result.recommendationVersion,
        selectedCandidateId: session.selectedCandidateId,
        selectionType: 'primary',
        deviationReason: '',
        costBaselineId: session.costBaselineId,
        costBaselineVersion: session.costBaselineVersion,
      },
      updatedAt: nowIso(),
    });

    const linked = this.getSession(sessionId, context);
    if (!linked) {
      return { ok: false, error: 'not_found' };
    }
    linked.offerId = created.offer.id;
    linked.offerCreationToken = token;
    linked.status = 'offer_created';
    linked.updatedAt = nowIso();
    saveBestPayComparisonSession(linked);
    return { ok: true, session: linked, offerId: created.offer.id };
  }

  canSeeCommission(context: BestPayComparisonUserContext): boolean {
    return context.role === 'admin' || context.role === 'field_service';
  }
}
