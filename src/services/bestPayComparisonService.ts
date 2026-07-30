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
import {
  DEFAULT_BESTPAY_COMPARISON_LIST_FILTERS,
  filterAndSortBestPayComparisons,
  resolveBestPayComparisonTitle,
  resolveResumeStep,
  type BestPayComparisonListFilters,
  type BestPayComparisonSummary,
} from '../domain/bestPayComparison/bestPayComparisonSummary';
import type { CustomerCostBaseline } from '../domain/billingImport/customerCostBaseline';
import type { User } from '../domain/user/user';
import { nowIso } from '../utils/id';
import type { LeadRepository } from '../repositories/interfaces/LeadRepository';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type { BillingImportService } from './billingImportService';
import type { RecommendationService } from './recommendationService';
import type { OfferService, OfferUserContext } from './offerService';
import {
  getActiveBestPayComparisonSessionId,
  migrateBestPayComparisonStorageIfNeeded,
  readBestPayComparisonSessions,
  removeBestPayComparisonSession,
  saveBestPayComparisonSession,
  setActiveBestPayComparisonSessionId,
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
  | 'validation'
  | 'not_deletable'
  | 'already_archived'
  | 'not_archived'
  | 'in_flight';

export class BestPayComparisonService {
  private readonly billingImportService: BillingImportService;
  private readonly recommendationService: RecommendationService;
  private readonly offerService: OfferService;
  private readonly leadRepository: LeadRepository;
  private readonly offerRepository: OfferRepository;
  private readonly inFlightActions = new Set<string>();

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

  private canAccessCalculator(context: BestPayComparisonUserContext): boolean {
    return context.role === 'admin' || context.role === 'field_service';
  }

  private canAccess(session: BestPayComparisonSession, context: BestPayComparisonUserContext): boolean {
    if (!this.canAccessCalculator(context)) {
      return false;
    }
    if (context.role === 'admin') {
      return true;
    }
    return session.createdByUserId === context.userId;
  }

  private withInFlight<T>(
    key: string,
    action: () => T,
  ): T | { ok: false; error: 'in_flight' } {
    if (this.inFlightActions.has(key)) {
      return { ok: false, error: 'in_flight' };
    }
    this.inFlightActions.add(key);
    try {
      return action();
    } finally {
      this.inFlightActions.delete(key);
    }
  }

  private touchTitle(session: BestPayComparisonSession): void {
    session.title = resolveBestPayComparisonTitle(session);
  }

  getActiveDraft(context: BestPayComparisonUserContext): BestPayComparisonSession | null {
    this.ensureMigrated();
    if (!this.canAccessCalculator(context)) {
      return null;
    }

    const activeId = getActiveBestPayComparisonSessionId();
    if (activeId) {
      const active = this.getSession(activeId, context);
      if (
        active &&
        active.status !== 'discarded' &&
        active.status !== 'offer_created' &&
        !active.archivedAt
      ) {
        return active;
      }
    }

    return (
      readBestPayComparisonSessions()
        .filter(
          (session) =>
            this.canAccess(session, context) &&
            session.status !== 'discarded' &&
            session.status !== 'offer_created' &&
            !session.archivedAt,
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
    if (!this.canAccessCalculator(context)) {
      throw new Error('FORBIDDEN');
    }
    const session = createBestPayComparisonSession(context.userId);
    this.touchTitle(session);
    saveBestPayComparisonSession(session);
    setActiveBestPayComparisonSessionId(session.id);
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
    if (getActiveBestPayComparisonSessionId() === sessionId) {
      setActiveBestPayComparisonSessionId(null);
    }
    return true;
  }

  listComparisons(
    context: BestPayComparisonUserContext,
    filters: Partial<BestPayComparisonListFilters> = {},
  ): BestPayComparisonSummary[] | null {
    this.ensureMigrated();
    if (!this.canAccessCalculator(context)) {
      return null;
    }
    const merged: BestPayComparisonListFilters = {
      ...DEFAULT_BESTPAY_COMPARISON_LIST_FILTERS,
      ...filters,
    };
    const sessions = readBestPayComparisonSessions().filter((session) => this.canAccess(session, context));
    return filterAndSortBestPayComparisons(sessions, merged);
  }

  getComparisonSummary(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): BestPayComparisonSummary | null {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return null;
    }
    return filterAndSortBestPayComparisons([session], {
      ...DEFAULT_BESTPAY_COMPARISON_LIST_FILTERS,
      includeArchived: true,
      status: 'all',
    })[0] ?? null;
  }

  resumeComparison(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): {
    ok: true;
    session: BestPayComparisonSession;
    step: ReturnType<typeof resolveResumeStep>;
  } | { ok: false; error: BestPayComparisonError } {
    const session = this.getSession(sessionId, context);
    if (!session || session.status === 'discarded') {
      return { ok: false, error: 'not_found' };
    }
    if (session.archivedAt) {
      return { ok: false, error: 'validation' };
    }

    const refreshed = this.refreshStaleStatus(sessionId, context);
    const current = refreshed ?? session;
    current.lastOpenedAt = nowIso();
    // lastOpenedAt allein aktualisiert updatedAt nicht
    saveBestPayComparisonSession(current);
    setActiveBestPayComparisonSessionId(current.id);
    return { ok: true, session: current, step: resolveResumeStep(current) };
  }

  refreshStaleStatus(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): BestPayComparisonSession | null {
    const session = this.getSession(sessionId, context);
    if (!session?.result) {
      return session;
    }

    const reasons: string[] = [...(session.result.staleReasons ?? [])];
    let stale = session.result.stale;

    if (session.billingImportSessionId && session.costBaselineVersion !== null) {
      const data = this.billingImportService.getSessionData(session.billingImportSessionId, context);
      const baseline = data?.baseline;
      if (baseline && baseline.version !== session.costBaselineVersion) {
        stale = true;
        if (!reasons.includes('Kostenbasis geändert')) {
          reasons.push('Kostenbasis geändert');
        }
      }
    }

    if (stale !== session.result.stale || reasons.length !== session.result.staleReasons.length) {
      session.result = {
        ...session.result,
        stale,
        staleReasons: reasons,
      };
      // Metadaten-Refresh ohne fachliche Änderung: updatedAt unverändert
      saveBestPayComparisonSession(session);
    }
    return session;
  }

  duplicateComparison(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ):
    | { ok: true; session: BestPayComparisonSession }
    | { ok: false; error: BestPayComparisonError; message?: string } {
    const result = this.withInFlight(`duplicate:${sessionId}:${context.userId}`, () => {
      const source = this.getSession(sessionId, context);
      if (!source || source.status === 'discarded') {
        return { ok: false as const, error: 'not_found' as const };
      }

      const timestamp = nowIso();
      const titleBase = resolveBestPayComparisonTitle(source);
      const copy = createBestPayComparisonSession(context.userId, {
        title: `${titleBase} (Kopie)`,
        source: source.source,
        leadId: source.leadId,
        customerLabel: source.customerLabel,
        leadDisplayName: source.leadDisplayName,
        billingImportSessionId: source.billingImportSessionId,
        costBaselineId: source.costBaselineId,
        costBaselineVersion: source.costBaselineVersion,
        manualInput: {
          ...source.manualInput,
          paymentUsage: { ...source.manualInput.paymentUsage },
        },
        result: null,
        selectedCandidateId: null,
        offerId: null,
        offerNumber: null,
        offerTitle: null,
        offerCreationToken: null,
        duplicateOfSessionId: source.id,
        status: source.costBaselineId || source.manualInput.monthlyCardVolumeCents !== null
          ? 'ready_for_calculation'
          : 'draft',
        createdAt: timestamp,
        updatedAt: timestamp,
        lastOpenedAt: null,
        completedAt: null,
        archivedAt: null,
        discardedAt: null,
      });

      saveBestPayComparisonSession(copy);
      setActiveBestPayComparisonSessionId(copy.id);
      return { ok: true as const, session: copy };
    });

    if ('error' in result && result.error === 'in_flight') {
      return { ok: false, error: 'in_flight', message: 'Duplizieren läuft bereits.' };
    }
    return result as
      | { ok: true; session: BestPayComparisonSession }
      | { ok: false; error: BestPayComparisonError; message?: string };
  }

  archiveComparison(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ):
    | { ok: true; session: BestPayComparisonSession }
    | { ok: false; error: BestPayComparisonError; message?: string } {
    const result = this.withInFlight(`archive:${sessionId}`, () => {
      const session = this.getSession(sessionId, context);
      if (!session || session.status === 'discarded') {
        return { ok: false as const, error: 'not_found' as const };
      }
      if (session.archivedAt) {
        return { ok: false as const, error: 'already_archived' as const };
      }
      session.archivedAt = nowIso();
      session.updatedAt = nowIso();
      saveBestPayComparisonSession(session);
      if (getActiveBestPayComparisonSessionId() === sessionId) {
        setActiveBestPayComparisonSessionId(null);
      }
      return { ok: true as const, session };
    });

    if ('error' in result && result.error === 'in_flight') {
      return { ok: false, error: 'in_flight' };
    }
    return result as
      | { ok: true; session: BestPayComparisonSession }
      | { ok: false; error: BestPayComparisonError; message?: string };
  }

  restoreComparison(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ):
    | { ok: true; session: BestPayComparisonSession }
    | { ok: false; error: BestPayComparisonError; message?: string } {
    const result = this.withInFlight(`restore:${sessionId}`, () => {
      const session = this.getSession(sessionId, context);
      if (!session || session.status === 'discarded') {
        return { ok: false as const, error: 'not_found' as const };
      }
      if (!session.archivedAt) {
        return { ok: false as const, error: 'not_archived' as const };
      }
      session.archivedAt = null;
      session.updatedAt = nowIso();
      saveBestPayComparisonSession(session);
      this.refreshStaleStatus(sessionId, context);
      const restored = this.getSession(sessionId, context);
      return restored
        ? { ok: true as const, session: restored }
        : { ok: false as const, error: 'not_found' as const };
    });

    if ('error' in result && result.error === 'in_flight') {
      return { ok: false, error: 'in_flight' };
    }
    return result as
      | { ok: true; session: BestPayComparisonSession }
      | { ok: false; error: BestPayComparisonError; message?: string };
  }

  deleteDraftComparison(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ):
    | { ok: true }
    | { ok: false; error: BestPayComparisonError; message?: string } {
    const result = this.withInFlight(`delete:${sessionId}`, () => {
      const session = this.getSession(sessionId, context);
      if (!session) {
        return { ok: false as const, error: 'not_found' as const };
      }
      const summary = this.getComparisonSummary(sessionId, context);
      if (!summary?.canDelete) {
        return {
          ok: false as const,
          error: 'not_deletable' as const,
          message: 'Nur reine lokale Entwürfe ohne Angebot können gelöscht werden. Bitte archivieren.',
        };
      }
      removeBestPayComparisonSession(sessionId);
      return { ok: true as const };
    });

    if ('error' in result && result.error === 'in_flight') {
      return { ok: false, error: 'in_flight' };
    }
    return result as { ok: true } | { ok: false; error: BestPayComparisonError; message?: string };
  }

  countArchived(context: BestPayComparisonUserContext): number {
    this.ensureMigrated();
    if (!this.canAccessCalculator(context)) {
      return 0;
    }
    return readBestPayComparisonSessions().filter(
      (session) => this.canAccess(session, context) && session.archivedAt && session.status !== 'discarded',
    ).length;
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
    this.touchTitle(session);
    saveBestPayComparisonSession(session);
    return { ok: true, session, billingSessionId: billingSession.id };
  }

  updateManualInput(
    sessionId: string,
    patch: Partial<BestPayManualInput>,
    context: BestPayComparisonUserContext,
  ): BestPayComparisonSession | null {
    const session = this.getSession(sessionId, context);
    if (!session || session.status === 'offer_created' || session.archivedAt) {
      return null;
    }

    session.manualInput = mergeManualInput(session.manualInput, patch);
    session.source = session.source === 'billing_import' ? 'mixed' : 'manual';
    if (session.status === 'draft' || session.status === 'billing_import') {
      session.status = 'ready_for_calculation';
    }
    if (session.result) {
      session.result.stale = true;
      session.result.staleReasons = ['Bedarf geändert'];
    }
    session.updatedAt = nowIso();
    this.touchTitle(session);
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
      if (
        session.costBaselineVersion !== null &&
        session.costBaselineVersion !== baseline.version &&
        session.result
      ) {
        session.result.stale = true;
        if (!session.result.staleReasons.includes('Kostenbasis geändert')) {
          session.result.staleReasons.push('Kostenbasis geändert');
        }
      }
      session.costBaselineId = baseline.id;
      session.costBaselineVersion = baseline.version;
      session.status = 'ready_for_calculation';
      session.updatedAt = nowIso();
      this.touchTitle(session);
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

  getConfirmedBaseline(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): CustomerCostBaseline | null {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return null;
    }
    return this.resolveBaseline(session, context);
  }

  async calculate(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): Promise<
    | { ok: true; session: BestPayComparisonSession }
    | { ok: false; error: BestPayComparisonError; message?: string }
  > {
    const session = this.getSession(sessionId, context);
    if (!session || session.archivedAt) {
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

    if (
      calculation.result.primaryCandidate &&
      !variants.some((v) => v.candidateId === calculation.result.primaryCandidate!.candidateId)
    ) {
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
    fresh.completedAt = nowIso();
    fresh.updatedAt = nowIso();
    this.touchTitle(fresh);
    saveBestPayComparisonSession(fresh);
    return { ok: true, session: fresh };
  }

  selectVariant(
    sessionId: string,
    candidateId: string,
    context: BestPayComparisonUserContext,
  ): BestPayComparisonSession | null {
    const session = this.getSession(sessionId, context);
    if (!session?.result || session.archivedAt) {
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
    if (!session || session.archivedAt) {
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
    session.leadDisplayName = lead.companyName;
    session.status =
      session.status === 'calculated' || session.status === 'recommendation_selected'
        ? 'assigned'
        : session.status;
    session.updatedAt = nowIso();
    this.touchTitle(session);
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
    if (!session || session.archivedAt) {
      return { ok: false, error: 'not_found' };
    }
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
    linked.offerNumber = created.offer.offerNumber;
    linked.offerTitle = created.offer.title;
    linked.offerCreationToken = token;
    linked.status = 'offer_created';
    linked.completedAt = linked.completedAt ?? nowIso();
    linked.updatedAt = nowIso();
    this.touchTitle(linked);
    saveBestPayComparisonSession(linked);
    return { ok: true, session: linked, offerId: created.offer.id };
  }

  canSeeCommission(context: BestPayComparisonUserContext): boolean {
    return context.role === 'admin' || context.role === 'field_service';
  }

  canAccessHistory(context: BestPayComparisonUserContext): boolean {
    return this.canAccessCalculator(context);
  }
}
