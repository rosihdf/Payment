import type { BestPayComparisonSession } from '../domain/bestPayComparison/bestPayComparisonSession';
import { buildCustomerNeedForComparison } from '../domain/bestPayComparison/buildCustomerNeedForComparison';
import {
  resolveCurrentMonthlyCosts,
  summarizeComparisonVariant,
  summarizePrimaryCandidate,
} from '../domain/bestPayComparison/comparisonSummary';
import {
  DEFAULT_SALES_WIZARD_PROSPECT,
  getNextSalesWizardStep,
  getPreviousSalesWizardStep,
  type SalesWizardProspectDraft,
  type SalesWizardScenario,
  type SalesWizardScenarioConfig,
  type SalesWizardStepId,
} from '../domain/bestPayComparison/salesWizard';
import { DEFAULT_CREATE_LEAD_INPUT } from '../domain/lead/defaults';
import type { CreateLeadInput } from '../domain/lead/lead';
import { generateId, nowIso } from '../utils/id';
import type {
  BestPayComparisonError,
  BestPayComparisonService,
  BestPayComparisonUserContext,
} from './bestPayComparisonService';
import type { LeadService } from './leadService';
import type { RecommendationService } from './recommendationService';
import {
  saveBestPayComparisonSession,
  setActiveBestPayComparisonSessionId,
} from './bestPayComparisonStorageMigration';

export type SalesWizardError =
  | BestPayComparisonError
  | 'step_invalid'
  | 'scenario_required'
  | 'approval_blocked'
  | 'lead_create_failed';

function defaultScenarioConfig(session: BestPayComparisonSession, label: string): SalesWizardScenarioConfig {
  return {
    label,
    preferredTermMonths: session.manualInput.preferredTermMonths,
    terminalCount: session.manualInput.terminalCount,
    paymentUsage: { ...session.manualInput.paymentUsage },
  };
}

export class SalesWizardService {
  private readonly bestPayComparisonService: BestPayComparisonService;
  private readonly recommendationService: RecommendationService;
  private readonly leadService: LeadService;

  constructor(
    bestPayComparisonService: BestPayComparisonService,
    recommendationService: RecommendationService,
    leadService: LeadService,
  ) {
    this.bestPayComparisonService = bestPayComparisonService;
    this.recommendationService = recommendationService;
    this.leadService = leadService;
  }

  private persist(session: BestPayComparisonSession): BestPayComparisonSession {
    session.updatedAt = nowIso();
    if (!session.title && session.wizard.prospectDraft.companyName.trim()) {
      session.customerLabel = session.wizard.prospectDraft.companyName.trim();
      session.title = session.wizard.prospectDraft.companyName.trim();
    }
    saveBestPayComparisonSession(session);
    return session;
  }

  startWizard(context: BestPayComparisonUserContext): BestPayComparisonSession {
    const session = this.bestPayComparisonService.createSession(context);
    session.entryMode = 'wizard';
    session.wizard = {
      enabled: true,
      currentStep: 'prospect',
      prospectDraft: { ...DEFAULT_SALES_WIZARD_PROSPECT },
      scenarios: [],
      selectedScenarioId: null,
      approvalAcknowledgedAt: null,
      approvalNotes: '',
      wizardCompletedAt: null,
    };
    setActiveBestPayComparisonSessionId(session.id);
    return this.persist(session);
  }

  resumeWizard(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): { ok: true; session: BestPayComparisonSession } | { ok: false; error: SalesWizardError } {
    const resumed = this.bestPayComparisonService.resumeComparison(sessionId, context);
    if (!resumed.ok) {
      return { ok: false, error: resumed.error };
    }
    const session = resumed.session;
    session.entryMode = 'wizard';
    session.wizard.enabled = true;
    if (!session.wizard.currentStep) {
      session.wizard.currentStep = 'prospect';
    }
    return { ok: true, session: this.persist(session) };
  }

  getSession(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): BestPayComparisonSession | null {
    return this.bestPayComparisonService.getSession(sessionId, context);
  }

  setStep(
    sessionId: string,
    step: SalesWizardStepId,
    context: BestPayComparisonUserContext,
  ): BestPayComparisonSession | null {
    const session = this.getSession(sessionId, context);
    if (!session || session.archivedAt) {
      return null;
    }
    session.wizard.currentStep = step;
    session.wizard.enabled = true;
    session.entryMode = 'wizard';
    return this.persist(session);
  }

  goNext(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): { ok: true; session: BestPayComparisonSession } | { ok: false; error: SalesWizardError; message?: string } {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    const validation = this.validateStep(session, session.wizard.currentStep);
    if (!validation.ok) {
      return validation;
    }
    let next = getNextSalesWizardStep(session.wizard.currentStep);
    if (!next) {
      return { ok: true, session };
    }

    // Freigabe nur bei Bedarf; sonst automatisch weiter zum Abschluss.
    if (next === 'approval') {
      const selected = session.wizard.scenarios.find(
        (scenario) => scenario.id === session.wizard.selectedScenarioId,
      );
      const needsReview =
        Boolean(selected?.approval?.adminReviewRequired) ||
        Boolean(selected?.approval?.detailReviewRequired) ||
        Boolean(selected?.approval?.approvalBlocked);
      if (!needsReview) {
        session.wizard.approvalAcknowledgedAt = session.wizard.approvalAcknowledgedAt ?? nowIso();
        next = 'closing';
      }
    }

    session.wizard.currentStep = next;
    return { ok: true, session: this.persist(session) };
  }

  goBack(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): BestPayComparisonSession | null {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return null;
    }
    const previous = getPreviousSalesWizardStep(session.wizard.currentStep);
    if (!previous) {
      return session;
    }
    session.wizard.currentStep = previous;
    return this.persist(session);
  }

  validateStep(
    session: BestPayComparisonSession,
    step: SalesWizardStepId,
  ): { ok: true } | { ok: false; error: SalesWizardError; message?: string } {
    switch (step) {
      case 'prospect':
        return { ok: true };
      case 'costs':
        if (!session.costBaselineId && session.manualInput.monthlyTotalCostsCents === null) {
          return {
            ok: false,
            error: 'incomplete_input',
            message: 'Bitte Abrechnung bestätigen oder Ist-Kosten manuell erfassen.',
          };
        }
        return { ok: true };
      case 'need':
        if (
          session.manualInput.monthlyCardVolumeCents === null &&
          session.manualInput.annualCardVolumeCents === null &&
          !session.costBaselineId
        ) {
          return {
            ok: false,
            error: 'incomplete_input',
            message: 'Bitte Umsatz oder bestätigte Kostenbasis erfassen.',
          };
        }
        return { ok: true };
      case 'variants': {
        const selected = session.wizard.scenarios.find(
          (scenario) => scenario.id === session.wizard.selectedScenarioId,
        );
        if (!selected?.result || !selected.selectedCandidateId) {
          return {
            ok: false,
            error: 'scenario_required',
            message: 'Bitte ein Szenario berechnen und eine Variante auswählen.',
          };
        }
        return { ok: true };
      }
      case 'offer':
        if (!session.offerId) {
          return {
            ok: false,
            error: 'incomplete_input',
            message: 'Bitte zuerst einen Angebotsentwurf erzeugen.',
          };
        }
        return { ok: true };
      case 'approval': {
        const selected = session.wizard.scenarios.find(
          (scenario) => scenario.id === session.wizard.selectedScenarioId,
        );
        if (selected?.approval?.approvalBlocked && !session.wizard.approvalAcknowledgedAt) {
          return {
            ok: false,
            error: 'approval_blocked',
            message: 'Freigabe ist blockiert. Bitte Hinweise prüfen und bestätigen.',
          };
        }
        return { ok: true };
      }
      case 'closing':
        return { ok: true };
      default:
        return { ok: false, error: 'step_invalid' };
    }
  }

  updateProspectDraft(
    sessionId: string,
    patch: Partial<SalesWizardProspectDraft>,
    context: BestPayComparisonUserContext,
  ): BestPayComparisonSession | null {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return null;
    }
    session.wizard.prospectDraft = { ...session.wizard.prospectDraft, ...patch };
    if (patch.companyName?.trim()) {
      session.customerLabel = patch.companyName.trim();
      session.leadDisplayName = patch.companyName.trim();
    }
    if (patch.industry !== undefined) {
      session.manualInput = {
        ...session.manualInput,
        industry: patch.industry,
      };
    }
    return this.persist(session);
  }

  async assignLead(
    sessionId: string,
    leadId: string,
    context: BestPayComparisonUserContext,
  ): Promise<{ ok: true; session: BestPayComparisonSession } | { ok: false; error: SalesWizardError }> {
    const assigned = await this.bestPayComparisonService.assignLead(sessionId, leadId, context);
    if (!assigned.ok) {
      return { ok: false, error: assigned.error };
    }
    const session = assigned.session;
    session.wizard.enabled = true;
    session.entryMode = 'wizard';
    return { ok: true, session: this.persist(session) };
  }

  async createLeadFromProspect(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): Promise<{ ok: true; session: BestPayComparisonSession; leadId: string } | { ok: false; error: SalesWizardError; message?: string }> {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    const draft = session.wizard.prospectDraft;
    if (
      !draft.companyName.trim() ||
      !draft.contactFirstName.trim() ||
      !draft.contactLastName.trim() ||
      !draft.phone.trim()
    ) {
      return {
        ok: false,
        error: 'incomplete_input',
        message: 'Firma, Ansprechpartner und Telefon sind für einen neuen Lead erforderlich.',
      };
    }

    const input: CreateLeadInput = {
      ...DEFAULT_CREATE_LEAD_INPUT,
      companyName: draft.companyName,
      contactFirstName: draft.contactFirstName,
      contactLastName: draft.contactLastName,
      phone: draft.phone,
      email: draft.email,
      industry: draft.industry,
      notes: draft.notes,
      monthlyCardTurnoverCents: session.manualInput.monthlyCardVolumeCents,
      monthlyTransactions: session.manualInput.monthlyTransactions,
      requiredTerminalCount: session.manualInput.terminalCount,
      paymentUsage: { ...session.manualInput.paymentUsage },
      cardMix: {
        girocardPercent: session.manualInput.girocardPercent ?? 60,
        debitPercent: session.manualInput.debitPercent ?? 10,
        creditPercent: session.manualInput.creditPercent ?? 25,
        otherPercent: session.manualInput.otherPercent ?? 5,
      },
    };

    const created = await this.leadService.createLead(input, context.userId);
    if (!created.ok || !('lead' in created)) {
      return { ok: false, error: 'lead_create_failed', message: 'Lead konnte nicht angelegt werden.' };
    }

    const assigned = await this.assignLead(sessionId, created.lead.id, context);
    if (!assigned.ok) {
      return { ok: false, error: assigned.error };
    }
    return { ok: true, session: assigned.session, leadId: created.lead.id };
  }

  async startBillingImport(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): Promise<{ ok: true; session: BestPayComparisonSession; billingSessionId: string } | { ok: false; error: SalesWizardError }> {
    return this.bestPayComparisonService.startBillingImport(sessionId, context);
  }

  updateNeed(
    sessionId: string,
    patch: Partial<BestPayComparisonSession['manualInput']>,
    context: BestPayComparisonUserContext,
  ): BestPayComparisonSession | null {
    const updated = this.bestPayComparisonService.updateManualInput(sessionId, patch, context);
    if (!updated) {
      return null;
    }
    updated.wizard.enabled = true;
    updated.entryMode = 'wizard';
    return this.persist(updated);
  }

  addScenario(
    sessionId: string,
    context: BestPayComparisonUserContext,
    label?: string,
  ): { ok: true; session: BestPayComparisonSession; scenarioId: string } | { ok: false; error: SalesWizardError } {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    const timestamp = nowIso();
    const index = session.wizard.scenarios.length + 1;
    const scenario: SalesWizardScenario = {
      id: generateId('wizard_scenario'),
      label: label?.trim() || `Szenario ${index}`,
      config: defaultScenarioConfig(session, label?.trim() || `Szenario ${index}`),
      result: null,
      selectedCandidateId: null,
      approval: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      duplicateOfScenarioId: null,
    };
    session.wizard.scenarios.push(scenario);
    if (!session.wizard.selectedScenarioId) {
      session.wizard.selectedScenarioId = scenario.id;
    }
    return { ok: true, session: this.persist(session), scenarioId: scenario.id };
  }

  duplicateScenario(
    sessionId: string,
    scenarioId: string,
    context: BestPayComparisonUserContext,
  ): { ok: true; session: BestPayComparisonSession; scenarioId: string } | { ok: false; error: SalesWizardError } {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    const source = session.wizard.scenarios.find((entry) => entry.id === scenarioId);
    if (!source) {
      return { ok: false, error: 'not_found' };
    }
    const timestamp = nowIso();
    const copy: SalesWizardScenario = {
      id: generateId('wizard_scenario'),
      label: `${source.label} (Kopie)`,
      config: {
        ...source.config,
        paymentUsage: { ...source.config.paymentUsage },
        label: `${source.label} (Kopie)`,
      },
      result: null,
      selectedCandidateId: null,
      approval: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      duplicateOfScenarioId: source.id,
    };
    session.wizard.scenarios.push(copy);
    session.wizard.selectedScenarioId = copy.id;
    return { ok: true, session: this.persist(session), scenarioId: copy.id };
  }

  deleteScenario(
    sessionId: string,
    scenarioId: string,
    context: BestPayComparisonUserContext,
  ): { ok: true; session: BestPayComparisonSession } | { ok: false; error: SalesWizardError } {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    session.wizard.scenarios = session.wizard.scenarios.filter((entry) => entry.id !== scenarioId);
    if (session.wizard.selectedScenarioId === scenarioId) {
      session.wizard.selectedScenarioId = session.wizard.scenarios[0]?.id ?? null;
    }
    return { ok: true, session: this.persist(session) };
  }

  updateScenarioConfig(
    sessionId: string,
    scenarioId: string,
    patch: Partial<SalesWizardScenarioConfig>,
    context: BestPayComparisonUserContext,
  ): BestPayComparisonSession | null {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return null;
    }
    const scenario = session.wizard.scenarios.find((entry) => entry.id === scenarioId);
    if (!scenario) {
      return null;
    }
    scenario.config = {
      ...scenario.config,
      ...patch,
      paymentUsage: {
        ...scenario.config.paymentUsage,
        ...(patch.paymentUsage ?? {}),
      },
    };
    if (patch.label) {
      scenario.label = patch.label;
    }
    scenario.result = null;
    scenario.selectedCandidateId = null;
    scenario.approval = null;
    scenario.updatedAt = nowIso();
    return this.persist(session);
  }

  async calculateScenario(
    sessionId: string,
    scenarioId: string,
    context: BestPayComparisonUserContext,
  ): Promise<{ ok: true; session: BestPayComparisonSession } | { ok: false; error: SalesWizardError; message?: string }> {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    const scenario = session.wizard.scenarios.find((entry) => entry.id === scenarioId);
    if (!scenario) {
      return { ok: false, error: 'not_found' };
    }

    await this.bestPayComparisonService.syncBaselineFromBilling(sessionId, context);
    const fresh = this.getSession(sessionId, context);
    if (!fresh) {
      return { ok: false, error: 'not_found' };
    }
    const target = fresh.wizard.scenarios.find((entry) => entry.id === scenarioId);
    if (!target) {
      return { ok: false, error: 'not_found' };
    }

    const baseline = this.bestPayComparisonService.getConfirmedBaseline(sessionId, context);
    const manualInput = {
      ...fresh.manualInput,
      preferredTermMonths: target.config.preferredTermMonths,
      terminalCount: target.config.terminalCount,
      paymentUsage: { ...target.config.paymentUsage },
    };

    const hasVolume =
      manualInput.monthlyCardVolumeCents !== null ||
      manualInput.annualCardVolumeCents !== null ||
      Boolean(baseline);
    if (!hasVolume) {
      return {
        ok: false,
        error: 'incomplete_input',
        message: 'Bitte zuerst Ist-Kosten oder Umsatz erfassen.',
      };
    }

    const need = buildCustomerNeedForComparison({
      manualInput,
      baseline,
      salesRepresentativeId: context.userId,
      leadId: fresh.leadId,
    });

    const calculation = await this.recommendationService.calculateForStandaloneNeed(need, context);
    if (!calculation.ok) {
      return { ok: false, error: 'calculation_failed' };
    }

    const currentMonthly = resolveCurrentMonthlyCosts(baseline, manualInput.monthlyTotalCostsCents);
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
      !variants.some((variant) => variant.candidateId === calculation.result.primaryCandidate!.candidateId)
    ) {
      variants.unshift(
        summarizePrimaryCandidate(
          calculation.result.primaryCandidate,
          calculation.result.scoredCandidates.find(
            (entry) =>
              entry.candidate.candidateId === calculation.result.primaryCandidate!.candidateId,
          )?.scoreBreakdown.totalScore ?? null,
          currentMonthly,
          calculation.result.primaryReasons,
        ),
      );
    }

    const primary = calculation.result.primaryCandidate;
    const approval = primary?.pricingEvaluation?.approval
      ? {
          adminReviewRequired: primary.pricingEvaluation.approval.adminReviewRequired,
          quickReviewPossible: primary.pricingEvaluation.approval.quickReviewPossible,
          detailReviewRequired: primary.pricingEvaluation.approval.detailReviewRequired,
          approvalBlocked: primary.pricingEvaluation.approval.approvalBlocked,
          reasons: primary.pricingEvaluation.approval.reasons.map(String),
        }
      : {
          adminReviewRequired: true,
          quickReviewPossible: true,
          detailReviewRequired: false,
          approvalBlocked: false,
          reasons: [],
        };

    target.result = {
      recommendationRecordId: calculation.record.id,
      recommendationVersion: calculation.record.version,
      primaryCandidateId: primary?.candidateId ?? null,
      variants,
      currentMonthlyCostsCents: currentMonthly,
      currentAnnualCostsCents: currentMonthly !== null ? currentMonthly * 12 : null,
      inputFingerprint: calculation.result.inputFingerprint,
      calculatedAt: nowIso(),
      stale: false,
      staleReasons: [],
    };
    target.selectedCandidateId = primary?.candidateId ?? variants[0]?.candidateId ?? null;
    target.approval = approval;
    target.updatedAt = nowIso();
    fresh.wizard.selectedScenarioId = target.id;
    return { ok: true, session: this.persist(fresh) };
  }

  selectScenarioVariant(
    sessionId: string,
    scenarioId: string,
    candidateId: string,
    context: BestPayComparisonUserContext,
  ): BestPayComparisonSession | null {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return null;
    }
    const scenario = session.wizard.scenarios.find((entry) => entry.id === scenarioId);
    if (!scenario?.result?.variants.some((variant) => variant.candidateId === candidateId)) {
      return null;
    }
    scenario.selectedCandidateId = candidateId;
    scenario.updatedAt = nowIso();
    session.wizard.selectedScenarioId = scenarioId;
    // Promote selected scenario into session result for offer creation reuse
    session.result = scenario.result;
    session.selectedCandidateId = candidateId;
    session.status = 'recommendation_selected';
    session.manualInput = {
      ...session.manualInput,
      preferredTermMonths: scenario.config.preferredTermMonths,
      terminalCount: scenario.config.terminalCount,
      paymentUsage: { ...scenario.config.paymentUsage },
    };
    return this.persist(session);
  }

  async createOffer(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): Promise<
    | { ok: true; session: BestPayComparisonSession; offerId: string }
    | { ok: false; error: SalesWizardError; message?: string }
  > {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    if (!session.wizard.selectedScenarioId || !session.result || !session.selectedCandidateId) {
      return { ok: false, error: 'scenario_required', message: 'Bitte zuerst eine Variante auswählen.' };
    }
    return this.bestPayComparisonService.createOfferFromComparison(sessionId, context);
  }

  acknowledgeApproval(
    sessionId: string,
    notes: string,
    context: BestPayComparisonUserContext,
  ): { ok: true; session: BestPayComparisonSession } | { ok: false; error: SalesWizardError; message?: string } {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    const selected = session.wizard.scenarios.find(
      (scenario) => scenario.id === session.wizard.selectedScenarioId,
    );
    if (selected?.approval?.approvalBlocked) {
      // Allow continue only with explicit acknowledgement for blocked cases.
      session.wizard.approvalNotes = notes.trim();
      if (!notes.trim()) {
        return {
          ok: false,
          error: 'approval_blocked',
          message: 'Bitte eine Begründung zur blockierten Freigabe hinterlegen.',
        };
      }
    }
    session.wizard.approvalAcknowledgedAt = nowIso();
    session.wizard.approvalNotes = notes.trim();
    return { ok: true, session: this.persist(session) };
  }

  completeWizard(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): { ok: true; session: BestPayComparisonSession } | { ok: false; error: SalesWizardError; message?: string } {
    const session = this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    if (!session.wizard.approvalAcknowledgedAt) {
      const selected = session.wizard.scenarios.find(
        (scenario) => scenario.id === session.wizard.selectedScenarioId,
      );
      if (!selected?.approval?.approvalBlocked) {
        session.wizard.approvalAcknowledgedAt = nowIso();
      } else {
        return {
          ok: false,
          error: 'approval_blocked',
          message: 'Freigabe muss bestätigt werden.',
        };
      }
    }
    session.wizard.currentStep = 'closing';
    session.wizard.wizardCompletedAt = nowIso();
    session.completedAt = session.completedAt ?? nowIso();
    return { ok: true, session: this.persist(session) };
  }
}
