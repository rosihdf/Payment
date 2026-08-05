import type { BestPayComparisonSession } from '../domain/bestPayComparison/bestPayComparisonSession';
import { buildCustomerNeedForComparison } from '../domain/bestPayComparison/buildCustomerNeedForComparison';
import {
  resolveCurrentMonthlyCosts,
  summarizeComparisonVariant,
  summarizePrimaryCandidate,
} from '../domain/bestPayComparison/comparisonSummary';
import { validateCostCaptureStep, type CostCaptureMode } from '../domain/bestPayComparison/costCaptureMode';
import { mergeManualInput } from '../domain/bestPayComparison/createBestPayComparisonSession';
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
import { getLeadDisplayName } from '../domain/lead/getLeadDisplayName';
import type { CreateLeadInput } from '../domain/lead/lead';
import { generateId, nowIso } from '../utils/id';
import type {
  BestPayComparisonError,
  BestPayComparisonService,
  BestPayComparisonUserContext,
} from './bestPayComparisonService';
import type { LeadService } from './leadService';
import type { RecommendationService } from './recommendationService';
import type { OfferWorkflowService } from './offerWorkflowService';
import type { OfferService } from './offerService';
import type { SalesActivityService } from './salesActivityService';
import type { BestPayComparisonRepository } from '../repositories/interfaces/BestPayComparisonRepository';
import {
  canDiscardEmptyAdviceSession,
  isEmptyAdviceSession,
} from '../domain/bestPayComparison/isEmptyAdviceSession';
import { createBestPayComparisonSession } from '../domain/bestPayComparison/createBestPayComparisonSession';

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
  private readonly offerWorkflowService: OfferWorkflowService | null;
  private readonly bestPayComparisonRepository: BestPayComparisonRepository;
  private activityService: SalesActivityService | null = null;

  constructor(
    bestPayComparisonService: BestPayComparisonService,
    recommendationService: RecommendationService,
    leadService: LeadService,
    offerWorkflowService: OfferWorkflowService | null = null,
    _offerService: OfferService | null = null,
    bestPayComparisonRepository: BestPayComparisonRepository,
  ) {
    this.bestPayComparisonService = bestPayComparisonService;
    this.recommendationService = recommendationService;
    this.leadService = leadService;
    this.offerWorkflowService = offerWorkflowService;
    this.bestPayComparisonRepository = bestPayComparisonRepository;
  }

  setActivityService(activityService: SalesActivityService): void {
    this.activityService = activityService;
  }

  private async recordAdviceStarted(
    session: BestPayComparisonSession,
    context: BestPayComparisonUserContext,
  ): Promise<void> {
    if (!session.leadId || !this.activityService) {
      return;
    }
    await this.activityService.recordSystemActivity(
      {
        type: 'advice_started',
        title: 'Beratung begonnen',
        description: session.title || '',
        leadId: session.leadId,
        comparisonSessionId: session.id,
        sourceKey: `advice_started:${session.id}`,
      },
      context,
    );
  }

  private async persist(session: BestPayComparisonSession): Promise<BestPayComparisonSession> {
    session.updatedAt = nowIso();
    if (!session.title && session.wizard.prospectDraft.companyName.trim()) {
      const displayName = getLeadDisplayName({
        companyName: session.wizard.prospectDraft.companyName,
        contactFirstName: session.wizard.prospectDraft.contactFirstName,
        contactLastName: session.wizard.prospectDraft.contactLastName,
        city: '',
      });
      session.customerLabel = displayName;
      session.title = displayName;
    }
    await this.bestPayComparisonRepository.save(session);
    return session;
  }

  private buildWizardSession(context: BestPayComparisonUserContext): BestPayComparisonSession {
    const session = createBestPayComparisonSession(context.userId);
    session.entryMode = 'wizard';
    session.wizard = {
      enabled: true,
      currentStep: 'prospect',
      costCaptureMode: null,
      prospectDraft: { ...DEFAULT_SALES_WIZARD_PROSPECT },
      scenarios: [],
      selectedScenarioId: null,
      // Deprecated: UI-Wiederaufnahmehinweis, nie Freigabequelle.
      approvalAcknowledgedAt: null,
      approvalNotes: '',
      followUpNotes: '',
      wizardCompletedAt: null,
    };
    return session;
  }

  async isWizardPersisted(sessionId: string): Promise<boolean> {
    const session = await this.bestPayComparisonRepository.getById(sessionId);
    return session !== null;
  }

  /**
   * Neue Beratung nur im Speicher – noch keine localStorage-/Historien-Persistenz.
   */
  createTransientWizard(context: BestPayComparisonUserContext): BestPayComparisonSession {
    return this.buildWizardSession(context);
  }

  /**
   * Speichert eine bisher nur lokale Beratung genau einmal und aktiviert Autosave.
   * Reihenfolge zwingend: Session zuerst, danach Aktivzeiger (FK auf sessions.id).
   */
  async persistWizardSession(
    session: BestPayComparisonSession,
    context: BestPayComparisonUserContext,
  ): Promise<BestPayComparisonSession> {
    session.entryMode = 'wizard';
    session.wizard.enabled = true;
    const alreadyPersisted = await this.isWizardPersisted(session.id);
    const saved = await this.persist(session);
    await this.bestPayComparisonRepository.setActiveSessionId(context.userId, saved.id);
    if (!alreadyPersisted) {
      await this.recordAdviceStarted(saved, context);
    }
    return saved;
  }

  /**
   * Expliziter Start mit Persistenz (Tests / bewusster Entwurf).
   * UI „Beratung starten“ nutzt createTransientWizard.
   */
  async startWizard(context: BestPayComparisonUserContext): Promise<BestPayComparisonSession> {
    return this.persistWizardSession(this.buildWizardSession(context), context);
  }

  async discardEmptyWizard(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): Promise<{ ok: true } | { ok: false; error: 'not_found' | 'not_empty' }> {
    const session = await this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    if (!canDiscardEmptyAdviceSession(session) || !isEmptyAdviceSession(session)) {
      return { ok: false, error: 'not_empty' };
    }
    const discarded = await this.bestPayComparisonService.discardSession(sessionId, context);
    return discarded ? { ok: true } : { ok: false, error: 'not_found' };
  }

  /** Löscht einen Beratungsentwurf (auch mit Inhalt), solange noch kein Angebot verknüpft ist. */
  async discardAdviceDraft(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): Promise<{ ok: true } | { ok: false; error: 'not_found' | 'has_offer' }> {
    const session = await this.getSession(sessionId, context);
    if (!session || session.status === 'discarded' || session.archivedAt) {
      return { ok: false, error: 'not_found' };
    }
    if (session.offerId) {
      return { ok: false, error: 'has_offer' };
    }
    const discarded = await this.bestPayComparisonService.discardSession(sessionId, context);
    return discarded ? { ok: true } : { ok: false, error: 'not_found' };
  }

  async resumeWizard(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): Promise<{ ok: true; session: BestPayComparisonSession } | { ok: false; error: SalesWizardError }> {
    const resumed = await this.bestPayComparisonService.resumeComparison(sessionId, context);
    if (!resumed.ok) {
      return { ok: false, error: resumed.error };
    }
    const session = resumed.session;
    session.entryMode = 'wizard';
    session.wizard.enabled = true;
    if (!session.wizard.currentStep) {
      session.wizard.currentStep = 'prospect';
    }
    if (session.offerId && this.offerWorkflowService) {
      const view = await this.offerWorkflowService.getWizardWorkflowView(session.offerId);
      if (view?.workflowStatus) {
        session.wizard.currentStep = this.offerWorkflowService.resolveWizardStepFromWorkflow(
          view.workflowStatus,
        );
      }
    }
    return { ok: true, session: await this.persist(session) };
  }

  async getSession(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): Promise<BestPayComparisonSession | null> {
    return this.bestPayComparisonService.getSession(sessionId, context);
  }

  async setStep(
    sessionId: string,
    step: SalesWizardStepId,
    context: BestPayComparisonUserContext,
  ): Promise<BestPayComparisonSession | null> {
    const session = await this.getSession(sessionId, context);
    if (!session || session.archivedAt) {
      return null;
    }
    session.wizard.currentStep = step;
    session.wizard.enabled = true;
    session.entryMode = 'wizard';
    return this.persist(session);
  }

  async goNext(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): Promise<{ ok: true; session: BestPayComparisonSession } | { ok: false; error: SalesWizardError; message?: string }> {
    const session = await this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    const validation = await this.validateStep(session, session.wizard.currentStep);
    if (!validation.ok) {
      return validation;
    }
    let next = getNextSalesWizardStep(session.wizard.currentStep);
    if (!next) {
      return { ok: true, session };
    }

    if (next === 'approval') {
      if (session.offerId && this.offerWorkflowService) {
        const view = await this.offerWorkflowService.getWizardWorkflowView(session.offerId);
        if (view) {
          const skipApproval =
            !view.approvalRequired ||
            view.approved ||
            (view.workflowStatus &&
              ['ready_to_send', 'sent', 'accepted', 'activation_pending', 'activated', 'released', 'accounted', 'paid'].includes(
                view.workflowStatus,
              ));
          if (skipApproval) {
            if (view.workflowStatus === 'draft' && !view.approvalRequired) {
              await this.offerWorkflowService.submitForApproval(session.offerId, {
                userId: context.userId,
                role: context.role,
                displayName: context.displayName ?? context.userId,
              });
            }
            next = 'closing';
          }
        }
      } else {
        const selected = session.wizard.scenarios.find(
          (scenario) => scenario.id === session.wizard.selectedScenarioId,
        );
        const needsReview =
          Boolean(selected?.approval?.adminReviewRequired) ||
          Boolean(selected?.approval?.detailReviewRequired) ||
          Boolean(selected?.approval?.approvalBlocked);
        if (!needsReview) {
          next = 'closing';
        }
      }
    }

    session.wizard.currentStep = next;
    return { ok: true, session: await this.persist(session) };
  }

  async goBack(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): Promise<BestPayComparisonSession | null> {
    const session = await this.getSession(sessionId, context);
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

  async validateStep(
    session: BestPayComparisonSession,
    step: SalesWizardStepId,
  ): Promise<{ ok: true } | { ok: false; error: SalesWizardError; message?: string }> {
    switch (step) {
      case 'prospect':
        return { ok: true };
      case 'costs': {
        const validation = validateCostCaptureStep(session);
        if (!validation.ok) {
          return {
            ok: false,
            error: 'incomplete_input',
            message: validation.message,
          };
        }
        return { ok: true };
      }
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
        if (session.offerId && this.offerWorkflowService) {
          const view = await this.offerWorkflowService.getWizardWorkflowView(session.offerId);
          if (
            view?.approvalRequired &&
            !view.approved &&
            view.workflowStatus &&
            ['approval_required', 'in_approval', 'draft', 'changes_requested'].includes(view.workflowStatus)
          ) {
            return {
              ok: false,
              error: 'approval_blocked',
              message: 'Freigabe ausstehend. Bitte Freigabe anfordern oder Entscheidung abwarten.',
            };
          }
        }
        const selected = session.wizard.scenarios.find((scenario) => scenario.id === session.wizard.selectedScenarioId);
        if (selected?.approval?.approvalBlocked && !session.wizard.approvalNotes.trim() && !session.offerId) {
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

  async updateProspectDraft(
    sessionId: string,
    patch: Partial<SalesWizardProspectDraft>,
    context: BestPayComparisonUserContext,
  ): Promise<BestPayComparisonSession | null> {
    const session = await this.getSession(sessionId, context);
    if (!session) {
      return null;
    }
    session.wizard.prospectDraft = { ...session.wizard.prospectDraft, ...patch };
    const displayName = getLeadDisplayName({
      companyName: session.wizard.prospectDraft.companyName,
      contactFirstName: session.wizard.prospectDraft.contactFirstName,
      contactLastName: session.wizard.prospectDraft.contactLastName,
      city: '',
    });
    session.customerLabel = displayName;
    session.leadDisplayName = displayName;
    if (!session.title || patch.companyName !== undefined) {
      session.title = displayName;
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
    const saved = await this.persist(session);
    await this.recordAdviceStarted(saved, context);
    return { ok: true, session: saved };
  }

  async createLeadFromProspect(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): Promise<{ ok: true; session: BestPayComparisonSession; leadId: string } | { ok: false; error: SalesWizardError; message?: string }> {
    const session = await this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    const draft = session.wizard.prospectDraft;
    const company = draft.companyName.trim();
    const contactFirstName = draft.contactFirstName.trim();
    const contactLastName = draft.contactLastName.trim();
    const contactLabel = [contactFirstName, contactLastName].filter(Boolean).join(' ');
    if (!company && !contactLabel) {
      return {
        ok: false,
        error: 'incomplete_input',
        message: 'Bitte Firma oder Name eingeben.',
      };
    }

    const input: CreateLeadInput = {
      ...DEFAULT_CREATE_LEAD_INPUT,
      companyName: company || contactLabel,
      contactFirstName: contactFirstName || (company ? 'Allgemein' : contactLabel.split(/\s+/)[0] ?? 'Allgemein'),
      contactLastName:
        contactLastName ||
        (company
          ? 'Anfrage'
          : contactLabel.split(/\s+/).slice(1).join(' ') || 'Anfrage'),
      phone: draft.phone.trim() || '0',
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
    const result = await this.bestPayComparisonService.startBillingImport(sessionId, context);
    if (!result.ok) {
      return result;
    }
    result.session.wizard.costCaptureMode = 'billing_import';
    result.session.wizard.enabled = true;
    result.session.entryMode = 'wizard';
    return {
      ok: true,
      session: await this.persist(result.session),
      billingSessionId: result.billingSessionId,
    };
  }

  async updateCostCaptureMode(
    sessionId: string,
    mode: CostCaptureMode,
    context: BestPayComparisonUserContext,
  ): Promise<BestPayComparisonSession | null> {
    const session = await this.getSession(sessionId, context);
    if (!session) {
      return null;
    }

    session.wizard.costCaptureMode = mode;
    if (mode === 'no_current_costs') {
      session.manualInput = mergeManualInput(session.manualInput, {
        monthlyTotalCostsCents: 0,
      });
      session.source = 'manual';
    } else if (mode === 'manual') {
      session.source =
        session.billingImportSessionId || session.costBaselineId ? 'mixed' : 'manual';
    }

    session.wizard.enabled = true;
    session.entryMode = 'wizard';
    return this.persist(session);
  }

  async updateNeed(
    sessionId: string,
    patch: Partial<BestPayComparisonSession['manualInput']>,
    context: BestPayComparisonUserContext,
  ): Promise<BestPayComparisonSession | null> {
    const updated = await this.bestPayComparisonService.updateManualInput(sessionId, patch, context);
    if (!updated) {
      return null;
    }
    updated.wizard.enabled = true;
    updated.entryMode = 'wizard';
    return this.persist(updated);
  }

  async addScenario(
    sessionId: string,
    context: BestPayComparisonUserContext,
    label?: string,
  ): Promise<{ ok: true; session: BestPayComparisonSession; scenarioId: string } | { ok: false; error: SalesWizardError }> {
    const session = await this.getSession(sessionId, context);
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
    return { ok: true, session: await this.persist(session), scenarioId: scenario.id };
  }

  async duplicateScenario(
    sessionId: string,
    scenarioId: string,
    context: BestPayComparisonUserContext,
  ): Promise<{ ok: true; session: BestPayComparisonSession; scenarioId: string } | { ok: false; error: SalesWizardError }> {
    const session = await this.getSession(sessionId, context);
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
    return { ok: true, session: await this.persist(session), scenarioId: copy.id };
  }

  async deleteScenario(
    sessionId: string,
    scenarioId: string,
    context: BestPayComparisonUserContext,
  ): Promise<{ ok: true; session: BestPayComparisonSession } | { ok: false; error: SalesWizardError }> {
    const session = await this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    session.wizard.scenarios = session.wizard.scenarios.filter((entry) => entry.id !== scenarioId);
    if (session.wizard.selectedScenarioId === scenarioId) {
      session.wizard.selectedScenarioId = session.wizard.scenarios[0]?.id ?? null;
    }
    return { ok: true, session: await this.persist(session) };
  }

  async updateScenarioConfig(
    sessionId: string,
    scenarioId: string,
    patch: Partial<SalesWizardScenarioConfig>,
    context: BestPayComparisonUserContext,
  ): Promise<BestPayComparisonSession | null> {
    const session = await this.getSession(sessionId, context);
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
    const session = await this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    const scenario = session.wizard.scenarios.find((entry) => entry.id === scenarioId);
    if (!scenario) {
      return { ok: false, error: 'not_found' };
    }

    await this.bestPayComparisonService.syncBaselineFromBilling(sessionId, context);
    const fresh = await this.getSession(sessionId, context);
    if (!fresh) {
      return { ok: false, error: 'not_found' };
    }
    const target = fresh.wizard.scenarios.find((entry) => entry.id === scenarioId);
    if (!target) {
      return { ok: false, error: 'not_found' };
    }

    const baseline = await this.bestPayComparisonService.getConfirmedBaseline(sessionId, context);
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
    // Wie in selectScenarioVariant(): Hauptempfehlung wird automatisch als Szenario-Auswahl
    // übernommen (siehe RecommendationStep.tsx) – daher hier ebenfalls sofort in das
    // Session-Ergebnis promoten, sonst blockiert createOffer()/createOfferFromScenario() mit
    // "Bitte zuerst eine Variante auswählen.", obwohl die UI bereits "Gewählt: …" anzeigt.
    if (target.selectedCandidateId) {
      fresh.result = target.result;
      fresh.selectedCandidateId = target.selectedCandidateId;
      fresh.status = 'recommendation_selected';
    }
    return { ok: true, session: await this.persist(fresh) };
  }

  async selectScenarioVariant(
    sessionId: string,
    scenarioId: string,
    candidateId: string,
    context: BestPayComparisonUserContext,
  ): Promise<BestPayComparisonSession | null> {
    const session = await this.getSession(sessionId, context);
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
    const session = await this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    if (!session.wizard.selectedScenarioId || !session.result || !session.selectedCandidateId) {
      return { ok: false, error: 'scenario_required', message: 'Bitte zuerst eine Variante auswählen.' };
    }
    const created = await this.bestPayComparisonService.createOfferFromComparison(sessionId, context);
    if (!created.ok) return created;
    const scenarioId = session.wizard.selectedScenarioId;
    if (scenarioId) {
      await this.offerWorkflowService?.syncOfferAfterWizardCreation(
        created.offerId,
        sessionId,
        scenarioId,
        { userId: context.userId, role: context.role, displayName: context.displayName ?? context.userId },
      );
    }
    return created;
  }

  async acknowledgeApproval(
    sessionId: string,
    notes: string,
    context: BestPayComparisonUserContext,
  ): Promise<{ ok: true; session: BestPayComparisonSession } | { ok: false; error: SalesWizardError; message?: string }> {
    const session = await this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    if (!session.offerId || !this.offerWorkflowService) {
      return {
        ok: false,
        error: 'incomplete_input',
        message: 'Bitte zuerst einen Angebotsentwurf erzeugen.',
      };
    }
    const selected = session.wizard.scenarios.find(
      (scenario) => scenario.id === session.wizard.selectedScenarioId,
    );
    if (selected?.approval?.approvalBlocked && !notes.trim()) {
      return {
        ok: false,
        error: 'approval_blocked',
        message: 'Bitte eine Begründung zur blockierten Freigabe hinterlegen.',
      };
    }
    const offerContext = {
      userId: context.userId,
      role: context.role,
      displayName: context.displayName ?? context.userId,
    };
    const result = await this.offerWorkflowService.submitForApproval(
      session.offerId,
      offerContext,
      notes.trim(),
    );
    if (!result.ok) {
      return {
        ok: false,
        error: 'approval_blocked',
        message: 'Freigabe konnte nicht eingereicht werden.',
      };
    }
    session.wizard.approvalNotes = notes.trim();
    // Deprecated UI resume hint only – not workflow truth.
    session.wizard.approvalAcknowledgedAt = nowIso();
    return { ok: true, session: await this.persist(session) };
  }

  async completeWizard(
    sessionId: string,
    context: BestPayComparisonUserContext,
  ): Promise<{ ok: true; session: BestPayComparisonSession } | { ok: false; error: SalesWizardError; message?: string }> {
    const session = await this.getSession(sessionId, context);
    if (!session) {
      return { ok: false, error: 'not_found' };
    }
    if (session.offerId && this.offerWorkflowService) {
      const view = await this.offerWorkflowService.getWizardWorkflowView(session.offerId);
      const allowed = [
        'approved',
        'ready_to_send',
        'sent',
        'accepted',
        'activation_pending',
        'activated',
        'released',
        'accounted',
        'paid',
      ];
      if (!view?.workflowStatus || !allowed.includes(view.workflowStatus)) {
        return {
          ok: false,
          error: 'approval_blocked',
          message: 'Der Angebotsworkflow ist noch nicht freigegeben oder versandbereit.',
        };
      }
    } else if (!session.wizard.approvalAcknowledgedAt) {
      return { ok: false, error: 'approval_blocked', message: 'Freigabe muss bestätigt werden.' };
    }
    session.wizard.currentStep = 'closing';
    session.wizard.wizardCompletedAt = nowIso();
    session.completedAt = session.completedAt ?? nowIso();
    const saved = await this.persist(session);
    if (saved.leadId && this.activityService) {
      await this.activityService.recordSystemActivity(
        {
          type: 'advice_completed',
          title: 'Beratung abgeschlossen',
          description: saved.title || '',
          leadId: saved.leadId,
          comparisonSessionId: saved.id,
          sourceKey: `advice_completed:${saved.id}`,
        },
        context,
      );
    }
    return { ok: true, session: saved };
  }

  async getWizardOfferContext(sessionId: string, context: BestPayComparisonUserContext) {
    const session = await this.getSession(sessionId, context);
    if (!session?.offerId) return null;
    return this.offerWorkflowService?.getWizardWorkflowView(session.offerId) ?? null;
  }
}
