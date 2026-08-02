import type { BestPayComparisonSession } from '../domain/bestPayComparison/bestPayComparisonSession';
import type { Lead } from '../domain/lead/lead';
import { getLeadDisplayName, getSessionCustomerDisplayName } from '../domain/lead/getLeadDisplayName';
import type { Offer } from '../domain/offer/offer';
import type { SalesActivity } from '../domain/salesWorkspace/salesActivity';
import {
  CUSTOMER_STAND_LABELS,
  deriveCustomerPrimaryAction,
  deriveCustomerStand,
} from '../domain/salesWorkspace/customerRecordView';
import {
  deriveSalesPipelinePhase,
  resolvePrimaryNextAction,
  SALES_PIPELINE_PHASE_LABELS,
  SALES_PIPELINE_PHASES,
  type SalesPipelinePhase,
} from '../domain/salesWorkspace/salesPipeline';
import type { SalesTask } from '../domain/salesWorkspace/salesTask';
import type { User } from '../domain/user/user';
import type { LeadRepository } from '../repositories/interfaces/LeadRepository';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type { SalesActivityRepository } from '../repositories/interfaces/SalesActivityRepository';
import type { SalesTaskRepository } from '../repositories/interfaces/SalesTaskRepository';
import type { ActivationBlockerRepository } from '../repositories/interfaces/ActivationBlockerRepository';
import type { ActivationCaseRepository } from '../repositories/interfaces/ActivationCaseRepository';
import type { BestPayComparisonRepository } from '../repositories/interfaces/BestPayComparisonRepository';
import type { CommissionCalculationRepository } from '../repositories/interfaces/CommissionCalculationRepository';
import type { ContractRepository } from '../repositories/interfaces/ContractRepository';
import type { OfferChangeRequestRepository } from '../repositories/interfaces/OfferChangeRequestRepository';
import type { OfferCustomerQuestionRepository } from '../repositories/interfaces/OfferCustomerQuestionRepository';
import type { PricingEvaluationRepository } from '../repositories/interfaces/PricingEvaluationRepository';
import type { CustomerPrimaryAction } from '../domain/salesWorkspace/customerRecordView';
import { buildSalesGuideNotifications, type SalesGuideNotification } from '../domain/sales/salesGuideNotifications';
import { salesWizardSessionPath } from '../utils/routes';
import type { SalesActivityService } from './salesActivityService';
import {
  buildSalesDayWorkspaceSections,
  type SalesDayWorkspaceSections,
} from './salesDayWorkspace';
import type { SalesTaskService } from './salesTaskService';
import { dueBucketOf, endOfDayIso, startOfDayIso } from './salesTaskService';

export interface SalesWorkspaceUserContext {
  userId: string;
  role: User['role'];
  displayName?: string;
}

export type SalesWorkspaceScope = 'mine' | 'team';

export interface SalesCaseCard {
  id: string;
  kind: 'lead' | 'unassigned';
  leadId: string | null;
  companyName: string;
  contactName: string;
  phase: SalesPipelinePhase;
  phaseLabel: string;
  standLabel: string;
  ownerUserId: string | null;
  lastActivityAt: string | null;
  nextTaskTitle: string | null;
  nextTaskDueAt: string | null;
  isOverdue: boolean;
  sessionId: string | null;
  wizardStep: string | null;
  offerId: string | null;
  offerNumber: string | null;
  expectedValueCents: number | null;
  nextActionLabel: string;
  nextActionHref: string | null;
  warning: string | null;
  staleCalculation: boolean;
  primaryKind: CustomerPrimaryAction['kind'];
  isHardBlocked: boolean;
}

export interface SalesWorkspaceMetrics {
  overdueTasks: number;
  todayTasks: number;
  openLeads: number;
  openWizardSessions: number;
  openCalculations: number;
  offersInApproval: number;
  openFollowUps: number;
  expectedClosings: number;
}

export interface SalesWorkspaceView {
  scope: SalesWorkspaceScope;
  canUseTeamScope: boolean;
  /** Tagesarbeit – sichtbarer Hauptinhalt des Arbeitsplatzes. */
  dayWork: SalesDayWorkspaceSections;
  /** Intern / Regression – nicht mehr im Hauptfluss der UI. */
  metrics: SalesWorkspaceMetrics;
  pipeline: Record<SalesPipelinePhase, SalesCaseCard[]>;
  unassignedSessions: SalesCaseCard[];
  todayTasks: SalesTask[];
  overdueTasks: SalesTask[];
  upcomingTasks: SalesTask[];
  openItems: {
    incompleteWizards: BestPayComparisonSession[];
    staleCalculations: BestPayComparisonSession[];
    offersInApproval: Offer[];
    sentWithoutFollowUp: Offer[];
  };
  expectedClosings: {
    acceptedOffers: Offer[];
    activationOffers: Offer[];
    accountedOffers: Offer[];
    unpaidCommissionOfferIds: string[];
  };
  timeline: SalesActivity[];
  notifications: SalesGuideNotification[];
  searchHits: Array<{
    kind: 'lead' | 'offer' | 'session' | 'task';
    id: string;
    title: string;
    subtitle: string;
    href: string;
  }>;
}

function contactName(lead: Lead): string {
  return `${lead.contactFirstName} ${lead.contactLastName}`.trim();
}

export class SalesWorkspaceService {
  private readonly leadRepository: LeadRepository;
  private readonly offerRepository: OfferRepository;
  private readonly taskRepository: SalesTaskRepository;
  private readonly activityRepository: SalesActivityRepository;
  private readonly taskService: SalesTaskService;
  private readonly bestPayComparisonRepository: BestPayComparisonRepository;
  private readonly commissionCalculationRepository: CommissionCalculationRepository;
  private readonly pricingEvaluationRepository: PricingEvaluationRepository;
  private readonly contractRepository: ContractRepository;
  private readonly activationCaseRepository: ActivationCaseRepository;
  private readonly activationBlockerRepository: ActivationBlockerRepository;
  private readonly questionRepository: OfferCustomerQuestionRepository;
  private readonly changeRequestRepository: OfferChangeRequestRepository;

  constructor(
    leadRepository: LeadRepository,
    offerRepository: OfferRepository,
    taskRepository: SalesTaskRepository,
    activityRepository: SalesActivityRepository,
    taskService: SalesTaskService,
    _activityService: SalesActivityService,
    bestPayComparisonRepository: BestPayComparisonRepository,
    commissionCalculationRepository: CommissionCalculationRepository,
    pricingEvaluationRepository: PricingEvaluationRepository,
    contractRepository: ContractRepository,
    activationCaseRepository: ActivationCaseRepository,
    activationBlockerRepository: ActivationBlockerRepository,
    questionRepository: OfferCustomerQuestionRepository,
    changeRequestRepository: OfferChangeRequestRepository,
  ) {
    this.leadRepository = leadRepository;
    this.offerRepository = offerRepository;
    this.taskRepository = taskRepository;
    this.activityRepository = activityRepository;
    this.taskService = taskService;
    this.bestPayComparisonRepository = bestPayComparisonRepository;
    this.commissionCalculationRepository = commissionCalculationRepository;
    this.pricingEvaluationRepository = pricingEvaluationRepository;
    this.contractRepository = contractRepository;
    this.activationCaseRepository = activationCaseRepository;
    this.activationBlockerRepository = activationBlockerRepository;
    this.questionRepository = questionRepository;
    this.changeRequestRepository = changeRequestRepository;
  }

  canUseTeamScope(context: SalesWorkspaceUserContext): boolean {
    return context.role === 'admin';
  }

  canSeeCommission(context: SalesWorkspaceUserContext): boolean {
    return context.role === 'admin' || context.role === 'field_service';
  }

  private isLeadVisible(lead: Lead, context: SalesWorkspaceUserContext, scope: SalesWorkspaceScope): boolean {
    if (scope === 'team' && context.role === 'admin') {
      return true;
    }
    return lead.assignedSalesUserId === context.userId || lead.createdByUserId === context.userId;
  }

  private isOfferVisible(offer: Offer, context: SalesWorkspaceUserContext, scope: SalesWorkspaceScope): boolean {
    if (scope === 'team' && context.role === 'admin') {
      return true;
    }
    return offer.createdByUserId === context.userId;
  }

  private isSessionVisible(
    session: BestPayComparisonSession,
    context: SalesWorkspaceUserContext,
    scope: SalesWorkspaceScope,
  ): boolean {
    if (scope === 'team' && context.role === 'admin') {
      return true;
    }
    return session.createdByUserId === context.userId;
  }

  private async approvalRequiredForOffer(offer: Offer): Promise<boolean> {
    const evaluations = await this.pricingEvaluationRepository.getByOfferId(offer.id);
    return evaluations.some(
      (entry) =>
        entry.result.approval.adminReviewRequired || entry.result.approval.approvalBlocked,
    );
  }

  private approvalRequiredForSession(session: BestPayComparisonSession): boolean {
    const selected = session.wizard.scenarios.find(
      (scenario) => scenario.id === session.wizard.selectedScenarioId,
    );
    return Boolean(
      selected?.approval?.adminReviewRequired ||
        selected?.approval?.detailReviewRequired ||
        selected?.approval?.approvalBlocked,
    );
  }

  async syncAutomaticTasks(context: SalesWorkspaceUserContext): Promise<void> {
    const sessions = (await this.bestPayComparisonRepository.getAll()).filter((session) =>
      this.isSessionVisible(session, context, 'mine'),
    );
    const offers = (await this.offerRepository.getAll()).filter((offer) =>
      this.isOfferVisible(offer, context, 'mine'),
    );

    for (const session of sessions) {
      if (
        session.status === 'discarded' ||
        session.archivedAt ||
        session.wizard.wizardCompletedAt ||
        session.completedAt
      ) {
        continue;
      }
      if (session.entryMode === 'wizard' || session.wizard.enabled) {
        await this.taskService.ensureAutomaticTask(
          {
            title: 'Berechnung fortsetzen',
            type: 'continue_calculation',
            priority: 'high',
            dueAt: endOfDayIso(),
            leadId: session.leadId,
            comparisonSessionId: session.id,
            wizardEnabled: true,
            sourceKey: `auto:continue_calculation:${session.id}`,
          },
          context,
        );
      }
    }

    const [contracts, activations] = await Promise.all([
      this.contractRepository.getAll(),
      this.activationCaseRepository.getAll(),
    ]);
    const activatedContractIds = new Set(activations.map((entry) => entry.contractId));

    for (const offer of offers) {
      if (!['accepted', 'activation_pending'].includes(offer.workflowStatus)) {
        continue;
      }
      const contract = contracts.find((entry) => entry.sourceOfferId === offer.id);
      if (!contract || activatedContractIds.has(contract.id)) {
        continue;
      }
      if (!['preparation', 'activation'].includes(contract.status)) {
        continue;
      }
      await this.taskService.ensureAutomaticTask(
        {
          title: 'Aktivierung starten',
          type: 'start_activation',
          priority: 'normal',
          dueAt: endOfDayIso(new Date(Date.now() + 3 * 86400000)),
          leadId: offer.leadId,
          offerId: offer.id,
          contractId: contract.id,
          sourceKey: `auto:start_activation:${contract.id}`,
        },
        context,
      );
    }
  }

  async getWorkspaceView(
    context: SalesWorkspaceUserContext,
    options: { scope?: SalesWorkspaceScope; query?: string } = {},
  ): Promise<SalesWorkspaceView> {
    const canUseTeamScope = this.canUseTeamScope(context);
    const scope: SalesWorkspaceScope =
      options.scope === 'team' && canUseTeamScope ? 'team' : 'mine';

    await this.syncAutomaticTasks(context);

    const [allLeads, allOffers, allTasks, allActivities, allSessions, commissionCases, allContracts, allActivations, allBlockers, allQuestions, allChangeRequests] =
      await Promise.all([
        this.leadRepository.getAll(),
        this.offerRepository.getAll(),
        this.taskRepository.getAll(),
        this.activityRepository.getAll(),
        this.bestPayComparisonRepository.getAll(),
        this.commissionCalculationRepository.getAllCases(),
        this.contractRepository.getAll(),
        this.activationCaseRepository.getAll(),
        this.activationBlockerRepository.getAll(),
        this.questionRepository.getAll(),
        this.changeRequestRepository.getAll(),
      ]);

    const leads = allLeads.filter((lead) => this.isLeadVisible(lead, context, scope));
    const offers = allOffers.filter((offer) => this.isOfferVisible(offer, context, scope));

    const draftApprovalFlags = new Map<string, boolean>();
    await Promise.all(
      offers
        .filter((offer) => offer.workflowStatus === 'draft')
        .map(async (offer) => {
          draftApprovalFlags.set(offer.id, await this.approvalRequiredForOffer(offer));
        }),
    );

    const sessions = allSessions.filter((session) => this.isSessionVisible(session, context, scope));
    const visibleLeadIds = new Set(leads.map((lead) => lead.id));
    const visibleOfferIds = new Set(offers.map((offer) => offer.id));
    const visibleSessionIds = new Set(sessions.map((session) => session.id));

    const tasks = allTasks.filter((task) => {
      if (scope === 'team' && context.role === 'admin') {
        return true;
      }
      return (
        task.assigneeUserId === context.userId ||
        task.createdByUserId === context.userId ||
        (task.leadId ? visibleLeadIds.has(task.leadId) : false)
      );
    });
    const activities = allActivities.filter((activity) => {
      if (scope === 'team' && context.role === 'admin') {
        return true;
      }
      return (
        activity.createdByUserId === context.userId ||
        (activity.leadId ? visibleLeadIds.has(activity.leadId) : false) ||
        (activity.offerId ? visibleOfferIds.has(activity.offerId) : false) ||
        (activity.comparisonSessionId
          ? visibleSessionIds.has(activity.comparisonSessionId)
          : false)
      );
    });

    const pipeline = Object.fromEntries(
      SALES_PIPELINE_PHASES.map((phase) => [phase, [] as SalesCaseCard[]]),
    ) as Record<SalesPipelinePhase, SalesCaseCard[]>;

    const cards: SalesCaseCard[] = [];
    const hardBlockedActivationIds = new Set(
      allBlockers
        .filter((blocker) => blocker.status === 'open' && blocker.severity === 'hard')
        .map((blocker) => blocker.activationId),
    );

    for (const lead of leads) {
      const leadSessions = sessions.filter((session) => session.leadId === lead.id);
      const leadOffers = offers.filter((offer) => offer.leadId === lead.id);
      const leadTasks = tasks.filter((task) => task.leadId === lead.id);
      const leadActivities = activities.filter((activity) => activity.leadId === lead.id);
      const relatedOfferIds = new Set(leadOffers.map((offer) => offer.id));
      const caseStatuses = commissionCases
        .filter((entry) => relatedOfferIds.has(entry.offerId))
        .map((entry) => entry.status);
      const commissionCaseStatus = caseStatuses[0] ?? null;
      const approvalRequired =
        leadOffers.some((offer) =>
          ['approval_required', 'in_approval', 'changes_requested'].includes(offer.workflowStatus) ||
          (offer.workflowStatus === 'draft' && draftApprovalFlags.get(offer.id)),
        ) ||
        leadSessions.some((session) => this.approvalRequiredForSession(session));

      const facts = {
        lead,
        sessions: leadSessions,
        offers: leadOffers,
        tasks: leadTasks,
        activities: leadActivities,
        commissionCaseStatus,
        approvalRequired,
        approvalBlocked: leadSessions.some(
          (session) =>
            session.wizard.scenarios.find((s) => s.id === session.wizard.selectedScenarioId)
              ?.approval?.approvalBlocked,
        ),
      };
      const phase = deriveSalesPipelinePhase(facts);
      const leadContracts = allContracts
        .filter((contract) => contract.leadId === lead.id)
        .map((contract) => ({
          id: contract.id,
          contractNumber: contract.contractNumber,
          status: contract.status,
          startDate: contract.startDate,
          endDate: contract.endDate,
          tariffName: contract.tariffName,
        }));
      const leadActivations = allActivations
        .filter((activation) => activation.leadId === lead.id)
        .map((activation) => ({
          id: activation.id,
          activationNumber: activation.activationNumber,
          status: activation.status,
          progressPercent: activation.progressPercent,
          nextStep: activation.nextStep,
          openBlockerCount: activation.openBlockerCount,
          contractId: activation.contractId,
        }));
      const customerFacts = {
        lead,
        sessions: leadSessions,
        offers: leadOffers,
        contracts: leadContracts,
        activations: leadActivations,
        openTasks: leadTasks.filter((task) => task.status === 'open' || task.status === 'in_progress'),
      };
      const stand = deriveCustomerStand(customerFacts);
      const primary = deriveCustomerPrimaryAction(customerFacts);
      const nextTask =
        leadTasks
          .filter((task) => task.status === 'open' || task.status === 'in_progress')
          .sort((left, right) => (left.dueAt ?? '9999').localeCompare(right.dueAt ?? '9999'))[0] ??
        null;
      const lastActivity = [...leadActivities].sort((a, b) =>
        b.occurredAt.localeCompare(a.occurredAt),
      )[0];
      const latestSession = [...leadSessions].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      )[0];
      const latestOffer = [...leadOffers].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      const hasHardActivationBlocker = leadActivations.some(
        (activation) =>
          hardBlockedActivationIds.has(activation.id) || activation.status === 'blocked',
      );
      const hasBlockingApproval = Boolean(facts.approvalBlocked);
      const isHardBlocked = hasHardActivationBlocker || hasBlockingApproval;

      const card: SalesCaseCard = {
        id: lead.id,
        kind: 'lead',
        leadId: lead.id,
        companyName: getLeadDisplayName(lead),
        contactName: contactName(lead),
        phase,
        phaseLabel: SALES_PIPELINE_PHASE_LABELS[phase],
        standLabel: CUSTOMER_STAND_LABELS[stand],
        ownerUserId: lead.assignedSalesUserId,
        lastActivityAt: lastActivity?.occurredAt ?? lead.updatedAt,
        nextTaskTitle: primary.label,
        nextTaskDueAt: primary.dueAt ?? nextTask?.dueAt ?? lead.nextFollowUpAt,
        isOverdue: primary.kind === 'overdue_follow_up',
        sessionId: latestSession?.id ?? null,
        wizardStep: latestSession?.wizard.enabled ? latestSession.wizard.currentStep : null,
        offerId: latestOffer?.id ?? null,
        offerNumber: latestOffer?.offerNumber ?? null,
        expectedValueCents: null,
        nextActionLabel: primary.label,
        nextActionHref: `/leads/${lead.id}`,
        warning: isHardBlocked
          ? hasHardActivationBlocker
            ? 'Harter Blocker'
            : 'Freigabe blockiert'
          : primary.warning && primary.warning !== 'Überfällig'
            ? primary.warning
            : primary.kind === 'overdue_follow_up'
              ? 'Überfällig'
              : null,
        staleCalculation: Boolean(latestSession?.result?.stale),
        primaryKind: primary.kind,
        isHardBlocked,
      };
      cards.push(card);
      pipeline[phase].push(card);
    }

    const unassignedSessions = sessions
      .filter((session) => !session.leadId && session.status !== 'discarded' && !session.archivedAt)
      .map((session) => {
        const sessionTasks = tasks.filter((task) => task.comparisonSessionId === session.id);
        const sessionActivities = activities.filter(
          (activity) => activity.comparisonSessionId === session.id,
        );
        const sessionOffers = offers.filter((offer) => offer.id === session.offerId);
        const facts = {
          lead: null,
          sessions: [session],
          offers: sessionOffers,
          tasks: sessionTasks,
          activities: sessionActivities,
          commissionCaseStatus: null,
          approvalRequired: this.approvalRequiredForSession(session),
          approvalBlocked: Boolean(
            session.wizard.scenarios.find((s) => s.id === session.wizard.selectedScenarioId)
              ?.approval?.approvalBlocked,
          ),
        };
        const phase = deriveSalesPipelinePhase(facts);
        const next = resolvePrimaryNextAction(phase, facts);
        const isHardBlocked = Boolean(facts.approvalBlocked);
        return {
          id: session.id,
          kind: 'unassigned' as const,
          leadId: null,
          companyName: getSessionCustomerDisplayName(session),
          contactName: 'Nicht zugeordnet',
          phase,
          phaseLabel: SALES_PIPELINE_PHASE_LABELS[phase],
          standLabel: 'Beratung',
          ownerUserId: session.createdByUserId,
          lastActivityAt: session.updatedAt,
          nextTaskTitle: next.label,
          nextTaskDueAt: null,
          isOverdue: false,
          sessionId: session.id,
          wizardStep: session.wizard.enabled ? session.wizard.currentStep : null,
          offerId: session.offerId,
          offerNumber: session.offerNumber,
          expectedValueCents: null,
          nextActionLabel: next.label,
          nextActionHref: next.href,
          warning: isHardBlocked ? 'Freigabe blockiert' : null,
          staleCalculation: Boolean(session.result?.stale),
          primaryKind: isHardBlocked ? ('blocker' as const) : ('continue_advice' as const),
          isHardBlocked,
        };
      });

    const openTasks = tasks.filter((task) => task.status === 'open' || task.status === 'in_progress');
    const overdueTasks = openTasks.filter((task) => dueBucketOf(task) === 'overdue');
    const todayTasks = openTasks.filter((task) => dueBucketOf(task) === 'today');
    const upcomingTasks = openTasks.filter((task) => dueBucketOf(task) === 'upcoming').slice(0, 20);

    const incompleteWizards = sessions
      .filter(
        (session) =>
          (session.entryMode === 'wizard' || session.wizard.enabled) &&
          !session.wizard.wizardCompletedAt &&
          session.status !== 'discarded' &&
          !session.archivedAt,
      )
      .slice(0, 50);
    const staleCalculations = sessions
      .filter((session) => session.result?.stale && session.status !== 'discarded')
      .slice(0, 50);
    const offersInApproval = offers.filter(
      (offer) => ['approval_required', 'in_approval', 'changes_requested'].includes(offer.workflowStatus) ||
        (offer.workflowStatus === 'draft' && draftApprovalFlags.get(offer.id)),
    );
    const followUpOfferIds = new Set(
      tasks
        .filter(
          (task) =>
            (task.status === 'open' || task.status === 'in_progress') &&
            task.type === 'follow_up_offer' &&
            task.offerId,
        )
        .map((task) => task.offerId as string),
    );
    const sentWithoutFollowUp = offers.filter((offer) => {
      const sent = activities.some(
        (activity) => activity.offerId === offer.id && activity.type === 'offer_sent',
      );
      return (sent || offer.workflowStatus === 'sent') && !followUpOfferIds.has(offer.id);
    });

    const acceptedOffers = offers.filter((offer) => offer.workflowStatus === 'accepted');
    const activationOfferIds = new Set(
      commissionCases
        .filter((entry) => entry.status === 'expected' || entry.status === 'reserved')
        .map((entry) => entry.offerId),
    );
    const accountedOfferIds = new Set(
      commissionCases
        .filter((entry) => entry.status === 'released' || entry.status === 'settled')
        .map((entry) => entry.offerId),
    );
    const unpaidCommissionOfferIds = commissionCases
      .filter((entry) =>
        ['expected', 'reserved', 'released', 'settled', 'partially_paid'].includes(entry.status),
      )
      .map((entry) => entry.offerId);

    const metrics: SalesWorkspaceMetrics = {
      overdueTasks: overdueTasks.length,
      todayTasks: todayTasks.length,
      openLeads: leads.filter((lead) => lead.status !== 'won' && lead.status !== 'lost').length,
      openWizardSessions: incompleteWizards.length,
      openCalculations: sessions.filter(
        (session) =>
          session.status !== 'discarded' &&
          !session.archivedAt &&
          (!session.result || session.result.stale),
      ).length,
      offersInApproval: offersInApproval.length,
      openFollowUps: openTasks.filter((task) => task.type === 'follow_up_offer').length,
      expectedClosings: acceptedOffers.length + activationOfferIds.size,
    };

    const query = options.query?.trim().toLowerCase() ?? '';
    const searchHits: SalesWorkspaceView['searchHits'] = [];
    if (query) {
      for (const lead of leads) {
        const haystack =
          `${getLeadDisplayName(lead)} ${lead.contactFirstName} ${lead.contactLastName} ${lead.phone} ${lead.email}`.toLowerCase();
        if (haystack.includes(query)) {
          searchHits.push({
            kind: 'lead',
            id: lead.id,
            title: getLeadDisplayName(lead),
            subtitle: contactName(lead),
            href: `/leads/${lead.id}`,
          });
        }
      }
      for (const offer of offers) {
        const haystack = `${offer.offerNumber} ${offer.title}`.toLowerCase();
        if (haystack.includes(query)) {
          searchHits.push({
            kind: 'offer',
            id: offer.id,
            title: offer.offerNumber,
            subtitle: offer.title,
            href: `/offers/${offer.id}`,
          });
        }
      }
      for (const session of sessions) {
        const sessionLabel = getSessionCustomerDisplayName(session);
        const haystack = `${sessionLabel} ${session.title ?? ''} ${session.customerLabel ?? ''}`.toLowerCase();
        if (haystack.includes(query)) {
          searchHits.push({
            kind: 'session',
            id: session.id,
            title: sessionLabel,
            subtitle: 'Berechnung',
            href: salesWizardSessionPath(session.id),
          });
        }
      }
      for (const task of tasks) {
        if (`${task.title} ${task.description}`.toLowerCase().includes(query)) {
          searchHits.push({
            kind: 'task',
            id: task.id,
            title: task.title,
            subtitle: task.type,
            href: '/sales',
          });
        }
      }
    }

    const dayWork = buildSalesDayWorkspaceSections({
      cards,
      tasks: openTasks,
    });

    const notifications = buildSalesGuideNotifications(
      activities,
      context.role,
      offersInApproval,
    );

    const feedbackNotifications: SalesGuideNotification[] = [];
    for (const question of allQuestions) {
      if (question.status !== 'open' || !visibleOfferIds.has(question.offerId)) {
        continue;
      }
      const relatedOffer = offers.find((entry) => entry.id === question.offerId);
      feedbackNotifications.push({
        id: `customer-question:${question.id}`,
        title: 'Offene Kundenrückfrage',
        description: question.questionText.slice(0, 120),
        occurredAt: question.askedAt,
        offerId: question.offerId,
        leadId: relatedOffer?.leadId ?? null,
      });
    }
    for (const request of allChangeRequests) {
      if (!['open', 'reviewed'].includes(request.status) || !visibleOfferIds.has(request.offerId)) {
        continue;
      }
      const relatedOffer = offers.find((entry) => entry.id === request.offerId);
      feedbackNotifications.push({
        id: `customer-change:${request.id}`,
        title: 'Offener Änderungswunsch',
        description: request.requestText.slice(0, 120),
        occurredAt: request.createdAt,
        offerId: request.offerId,
        leadId: relatedOffer?.leadId ?? null,
      });
    }

    return {
      scope,
      canUseTeamScope,
      dayWork,
      metrics,
      pipeline,
      unassignedSessions,
      todayTasks: todayTasks.slice(0, 50),
      overdueTasks: overdueTasks.slice(0, 50),
      upcomingTasks,
      openItems: {
        incompleteWizards,
        staleCalculations,
        offersInApproval,
        sentWithoutFollowUp,
      },
      expectedClosings: {
        acceptedOffers,
        activationOffers: offers.filter((offer) => activationOfferIds.has(offer.id)),
        accountedOffers: offers.filter((offer) => accountedOfferIds.has(offer.id)),
        unpaidCommissionOfferIds,
      },
      timeline: [...activities]
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
        .slice(0, 50),
      notifications: [...feedbackNotifications, ...notifications],
      searchHits: searchHits.slice(0, 30),
    };
  }

  /**
   * Leseansicht für die Kundenakte – ohne syncAutomaticTasks / ohne Side Effects.
   */
  async getLeadWorkspaceSummary(
    leadId: string,
    context: SalesWorkspaceUserContext,
  ): Promise<{
    phase: SalesPipelinePhase;
    phaseLabel: string;
    openTasks: SalesTask[];
    nextTask: SalesTask | null;
    timeline: SalesActivity[];
    sessions: BestPayComparisonSession[];
    offers: Offer[];
  } | null> {
    const lead = await this.leadRepository.getById(leadId);
    if (!lead) {
      return null;
    }
    const scope: SalesWorkspaceScope =
      context.role === 'admin' ? 'team' : 'mine';
    if (!this.isLeadVisible(lead, context, scope)) {
      return null;
    }

    const tasks = (await this.taskRepository.getAll()).filter((task) => task.leadId === leadId);
    const openTasks = tasks.filter((task) => task.status === 'open' || task.status === 'in_progress');
    const activities = (await this.activityRepository.getAll())
      .filter((activity) => activity.leadId === leadId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 30);
    const sessions = (await this.bestPayComparisonRepository.getAll()).filter((session) => session.leadId === leadId);
    const offers = (await this.offerRepository.getAll()).filter((offer) => offer.leadId === leadId);
    const phase = deriveSalesPipelinePhase({
      lead,
      sessions,
      offers,
      tasks: openTasks,
      activities,
      commissionCaseStatus: null,
      approvalRequired: false,
      approvalBlocked: false,
    });

    return {
      phase,
      phaseLabel: SALES_PIPELINE_PHASE_LABELS[phase],
      openTasks,
      nextTask: openTasks.sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'))[0] ?? null,
      timeline: activities,
      sessions,
      offers,
    };
  }
}

export { startOfDayIso };
