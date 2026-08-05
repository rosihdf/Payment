import type { CommissionAssignmentVersion } from '../domain/commission/commissionAssignmentVersion';
import type { SalesRepresentativeCommissionAssignment } from '../domain/commission/commissionAssignment';
import {
  assignmentsOverlap,
  buildDefaultOverridesForRules,
  getActiveAssignmentForRepresentative,
  hasIndividualAgreement,
  resolveModelFromPlanVersion,
  resolvePlanVersionIdForModel,
} from '../domain/commission/commissionAssignmentHelpers';
import type { CommissionCalculationInput } from '../domain/commission/commissionCalculationInput';
import type {
  CommissionBonusPayment,
  CommissionBonusStatus,
} from '../domain/commission/commissionBonusPayment';
import { commissionBusinessStatusLabel } from '../domain/commission/commissionBusinessStatus';
import type { CommissionCase, CommissionCaseStatus, CommissionEventType } from '../domain/commission/commissionCase';
import type { CommissionPaymentRecord } from '../domain/commission/commissionPaymentRecord';
import type { CommissionRuleOverride } from '../domain/commission/commissionRuleOverride';
import {
  isIndividualOverride,
  normalizeOverrideToShareTruth,
  resolveSharePercent,
} from '../domain/commission/commissionRuleOverride';
import {
  calculateAmountFromShare,
  formatEuroCents,
  isValidCommissionSharePercent,
} from '../domain/commission/commissionShare';
import { evaluateCommission } from '../domain/commissionEngine/commissionCalculationEngine';
import { getLeadDisplayName } from '../domain/lead/getLeadDisplayName';
import type { UserContext } from '../domain/user/user';
import type { ActivationBlockerRepository } from '../repositories/interfaces/ActivationBlockerRepository';
import type { ActivationCaseRepository } from '../repositories/interfaces/ActivationCaseRepository';
import type { CommissionCalculationRepository } from '../repositories/interfaces/CommissionCalculationRepository';
import type { CommissionWorkflowRepository } from '../repositories/interfaces/CommissionWorkflowRepository';
import type { ContractRepository } from '../repositories/interfaces/ContractRepository';
import type { OfferRepository } from '../repositories/interfaces/OfferRepository';
import type { UserRepository } from '../repositories/interfaces/UserRepository';
import type { CommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import { generateId, nowIso } from '../utils/id';
import { formatPersistError } from '../utils/persistError';
import type { AuditService } from './auditService';
import { requirePermission } from './auditService';
import type { SalesActivityService } from './salesActivityService';

export interface RepresentativeAssignmentRow {
  userId: string;
  name: string;
  email: string;
  status: string;
  model: 'classic' | 'variable' | null;
  modelLabel: string;
  validFrom: string | null;
  validUntil: string | null;
  hasIndividualOverrides: boolean;
  assignmentId: string | null;
  lastChangedAt: string | null;
  lastChangedByUserId: string | null;
}

export interface AssignmentRuleView {
  ruleId: string;
  ruleName: string;
  standardAmountCents: number | null;
  /** Anzeige des Unternehmensstandards (Euro oder Basis-%). */
  standardLabel: string;
  sharePercent: number;
  calculatedAmountCents: number | null;
  /** Anzeige des abgeleiteten Mitarbeiterwerts. */
  calculatedLabel: string;
  isIndividual: boolean;
}

export interface AssignmentDetailView {
  assignment: SalesRepresentativeCommissionAssignment | null;
  currentVersion: CommissionAssignmentVersion | null;
  versions: CommissionAssignmentVersion[];
  standardOverrides: CommissionRuleOverride[];
  currentOverrides: CommissionRuleOverride[];
  model: 'classic' | 'variable' | null;
  ruleViews: AssignmentRuleView[];
}

export interface CommissionOverviewRow {
  caseId: string;
  salesRepresentativeId: string;
  salesRepresentativeName: string;
  customerName: string;
  offerId: string;
  contractId: string | null;
  activationId: string | null;
  amountCents: number;
  model: string;
  status: CommissionCaseStatus;
  statusLabel: string;
  dueDate: string | null;
  nextAction: string;
  /** Provision 2.0: eingefrorene Berechnungsdetails */
  standardLabel: string;
  shareSummary: string;
  endAmountCents: number;
  bonusAmountCents: number;
  reductionAmountCents: number;
  planVersionLabel: string;
  appliedRuleNames: string;
}

export interface CommissionOverviewSummary {
  calculatedCents: number;
  releasedCents: number;
  settledCents: number;
  paidCents: number;
  bonusOpenCents: number;
  bonusApprovedCents: number;
  bonusPaidCents: number;
  reductionCents: number;
  totalCents: number;
  /** Provision 2.0 Kennzahlen */
  classicRuleCount: number;
  variableRuleCount: number;
  individualAgreementCount: number;
  expectedCaseCount: number;
  pendingReleaseCaseCount: number;
  releasedCaseCount: number;
  settledCaseCount: number;
  paidCaseCount: number;
  bonusCount: number;
}

export interface SalesCommissionSummary {
  openCents: number;
  expectedCents: number;
  releasedCents: number;
  paidCents: number;
  bonusCents: number;
  reductionCents: number;
  monthCents: number;
  yearCents: number;
  totalCents: number;
}

function defaultCaseFields(): Pick<
  CommissionCase,
  | 'contractId'
  | 'activationId'
  | 'reductionAmountCents'
  | 'reductionReason'
  | 'accountingReference'
  | 'paymentReference'
  | 'dueDate'
> {
  return {
    contractId: null,
    activationId: null,
    reductionAmountCents: 0,
    reductionReason: null,
    accountingReference: null,
    paymentReference: null,
    dueDate: null,
  };
}

export class CommissionAdminService {
  private readonly catalogRepository: CommissionCatalogRepository;
  private readonly calculationRepository: CommissionCalculationRepository;
  private readonly workflowRepository: CommissionWorkflowRepository;
  private readonly userRepository: UserRepository;
  private readonly offerRepository: OfferRepository;
  private readonly contractRepository: ContractRepository;
  private readonly activationCaseRepository: ActivationCaseRepository;
  private readonly activationBlockerRepository: ActivationBlockerRepository;
  private readonly auditService: AuditService;
  private activityService: SalesActivityService | null = null;

  constructor(
    catalogRepository: CommissionCatalogRepository,
    calculationRepository: CommissionCalculationRepository,
    workflowRepository: CommissionWorkflowRepository,
    userRepository: UserRepository,
    offerRepository: OfferRepository,
    contractRepository: ContractRepository,
    activationCaseRepository: ActivationCaseRepository,
    activationBlockerRepository: ActivationBlockerRepository,
    auditService: AuditService,
  ) {
    this.catalogRepository = catalogRepository;
    this.calculationRepository = calculationRepository;
    this.workflowRepository = workflowRepository;
    this.userRepository = userRepository;
    this.offerRepository = offerRepository;
    this.contractRepository = contractRepository;
    this.activationCaseRepository = activationCaseRepository;
    this.activationBlockerRepository = activationBlockerRepository;
    this.auditService = auditService;
  }

  setActivityService(activityService: SalesActivityService): void {
    this.activityService = activityService;
  }

  private async requireAdmin(context: UserContext) {
    return requirePermission(context, 'admin.commission');
  }

  private async logCommissionEvent(
    eventType: CommissionEventType,
    context: UserContext,
    input: {
      caseId?: string | null;
      calculationId?: string | null;
      previousStatus?: string | null;
      newStatus?: string | null;
      amountCents?: number | null;
      reason: string;
      metadata?: Record<string, string | number | boolean | null>;
    },
  ) {
    await this.calculationRepository.createEvent({
      id: generateId('commission_event'),
      commissionCaseId: input.caseId ?? null,
      commissionCalculationId: input.calculationId ?? null,
      eventType,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
      amountCents: input.amountCents ?? null,
      currency: 'EUR',
      reason: input.reason,
      triggeredByUserId: context.userId,
      occurredAt: nowIso(),
      metadata: input.metadata ?? {},
    });
  }

  async listRepresentativeAssignments(context: UserContext): Promise<RepresentativeAssignmentRow[] | { error: 'forbidden' }> {
    const guard = await this.requireAdmin(context);
    if (!guard.ok) {
      return { error: 'forbidden' };
    }

    const [users, catalog] = await Promise.all([
      this.userRepository.getAll(),
      this.catalogRepository.getCatalog(),
    ]);

    const reps = users.filter((user) => user.role === 'field_service');
    const versionIds = [
      ...new Set(
        catalog.assignments
          .map((assignment) => assignment.currentVersionId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const versions = await this.workflowRepository.getAssignmentVersionsByIds(versionIds);
    const versionById = new Map(versions.map((version) => [version.id, version]));

    return reps.map((user) => {
      const assignment = getActiveAssignmentForRepresentative(
        catalog.assignments,
        user.id,
        nowIso(),
      );
      const model = assignment
        ? resolveModelFromPlanVersion(
            assignment.commissionPlanVersionId,
            catalog.commissionPlans,
            catalog.commissionPlanVersions,
          )
        : null;
      const currentVersion = assignment?.currentVersionId
        ? versionById.get(assignment.currentVersionId) ?? null
        : null;
      const currentOverrides = currentVersion?.ruleOverrides ?? [];
      const hasIndividualOverrides = hasIndividualAgreement(currentOverrides);

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        model,
        modelLabel: model === 'classic' ? 'Classic' : model === 'variable' ? 'Variable' : '—',
        validFrom: assignment?.validFrom ?? null,
        validUntil: assignment?.validUntil ?? null,
        hasIndividualOverrides,
        assignmentId: assignment?.id ?? null,
        lastChangedAt: assignment?.updatedAt ?? null,
        lastChangedByUserId: assignment?.createdByUserId ?? null,
      };
    });
  }

  async getAssignmentDetail(
    context: UserContext,
    salesRepresentativeId: string,
    options?: { model?: 'classic' | 'variable' },
  ): Promise<AssignmentDetailView | { error: 'forbidden' }> {
    const guard = await this.requireAdmin(context);
    if (!guard.ok) {
      return { error: 'forbidden' };
    }

    const catalog = await this.catalogRepository.getCatalog();
    const assignment = getActiveAssignmentForRepresentative(
      catalog.assignments,
      salesRepresentativeId,
      nowIso(),
    );
    const currentVersion = assignment?.currentVersionId
      ? await this.workflowRepository.getAssignmentVersionById(assignment.currentVersionId)
      : null;
    const assignmentVersions = currentVersion ? [currentVersion] : [];
    const assignedModel = assignment
      ? resolveModelFromPlanVersion(
          assignment.commissionPlanVersionId,
          catalog.commissionPlans,
          catalog.commissionPlanVersions,
        )
      : 'classic';
    const model = options?.model ?? assignedModel ?? 'classic';
    const planVersionId = resolvePlanVersionIdForModel(model);
    const modelChanged = options?.model != null && options.model !== assignedModel;
    const planRules = catalog.commissionRules.filter(
      (rule) => rule.commissionPlanVersionId === planVersionId && rule.status === 'active',
    );
    const standardOverrides = buildDefaultOverridesForRules(planRules);
    const currentOverrides =
      !modelChanged && currentVersion?.ruleOverrides?.length
        ? currentVersion.ruleOverrides
        : standardOverrides;
    const overrideByRule = new Map(
      currentOverrides.map((entry) => {
        const rule = planRules.find((item) => item.id === entry.ruleId);
        return [entry.ruleId, normalizeOverrideToShareTruth(entry, rule)] as const;
      }),
    );
    const ruleViews: AssignmentRuleView[] = planRules.map((rule) => {
      const override = overrideByRule.get(rule.id);
      const sharePercent = resolveSharePercent(override);
      const hasLeadingShare =
        override?.sharePercent != null && isValidCommissionSharePercent(override.sharePercent);
      const calculatedAmountCents =
        !hasLeadingShare && override?.fixedAmountCents != null
          ? override.fixedAmountCents
          : calculateAmountFromShare(rule.fixedAmountCents, sharePercent);
      const standardLabel =
        rule.fixedAmountCents != null
          ? formatEuroCents(rule.fixedAmountCents)
          : rule.percentTenthsOfBasisPoint != null
            ? `${rule.percentTenthsOfBasisPoint / 100} % der Basis`
            : '—';
      const calculatedLabel =
        calculatedAmountCents != null
          ? formatEuroCents(calculatedAmountCents)
          : rule.percentTenthsOfBasisPoint != null
            ? `${((rule.percentTenthsOfBasisPoint / 100) * sharePercent) / 100} % der Basis (${sharePercent} %)`
            : '—';
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        standardAmountCents: rule.fixedAmountCents,
        standardLabel,
        sharePercent,
        calculatedAmountCents,
        calculatedLabel,
        isIndividual: override ? isIndividualOverride(override) : false,
      };
    });

    return {
      assignment,
      currentVersion,
      versions: assignmentVersions,
      standardOverrides,
      currentOverrides,
      model,
      ruleViews,
    };
  }

  async saveAssignment(
    context: UserContext,
    input: {
      salesRepresentativeId: string;
      model: 'classic' | 'variable';
      validFrom: string;
      validUntil: string | null;
      ruleOverrides: CommissionRuleOverride[];
      changeNote: string;
    },
  ): Promise<{ ok: true; assignment: SalesRepresentativeCommissionAssignment } | { ok: false; error: string }> {
    const guard = await this.requireAdmin(context);
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const [assignments, commissionRules] = await Promise.all([
      this.catalogRepository.getAssignments(),
      this.catalogRepository.getRules(),
    ]);
    const planVersionId = resolvePlanVersionIdForModel(input.model);
    const timestamp = nowIso();

    for (const override of input.ruleOverrides) {
      if (
        override.sharePercent != null &&
        !isValidCommissionSharePercent(override.sharePercent)
      ) {
        return { ok: false, error: 'share_range' };
      }
    }

    const planRules = commissionRules.filter(
      (rule) => rule.commissionPlanVersionId === planVersionId,
    );
    const ruleById = new Map(planRules.map((rule) => [rule.id, rule]));
    const normalizedOverrides = input.ruleOverrides.map((override) =>
      normalizeOverrideToShareTruth(override, ruleById.get(override.ruleId)),
    );

    const overlapping = assignments.some(
      (assignment) =>
        assignment.salesRepresentativeId === input.salesRepresentativeId &&
        assignment.id !==
          (assignments.find(
            (entry) =>
              entry.salesRepresentativeId === input.salesRepresentativeId && entry.status === 'active',
          )?.id ?? '') &&
        assignmentsOverlap(assignment, {
          validFrom: input.validFrom,
          validUntil: input.validUntil,
          status: 'active',
          isPrimary: true,
        }),
    );

    if (overlapping) {
      return { ok: false, error: 'overlap' };
    }

    const existing = assignments.find(
      (assignment) =>
        assignment.salesRepresentativeId === input.salesRepresentativeId &&
        assignment.status === 'active' &&
        assignment.isPrimary,
    );

    let assignment: SalesRepresentativeCommissionAssignment;

    if (existing) {
      assignment = {
        ...existing,
        commissionPlanVersionId: planVersionId,
        validFrom: input.validFrom,
        validUntil: input.validUntil,
        reason: input.changeNote,
        updatedAt: timestamp,
      };
      if (existing.currentVersionId) {
        const currentVersion = await this.workflowRepository.getAssignmentVersionById(
          existing.currentVersionId,
        );
        if (
          currentVersion &&
          existing.commissionPlanVersionId === planVersionId &&
          existing.validFrom === input.validFrom &&
          existing.validUntil === input.validUntil &&
          JSON.stringify(currentVersion.ruleOverrides) === JSON.stringify(normalizedOverrides)
        ) {
          return { ok: true, assignment: existing };
        }
      }
    } else {
      assignment = {
        id: generateId('commission_assignment'),
        salesRepresentativeId: input.salesRepresentativeId,
        commissionPlanVersionId: planVersionId,
        currentVersionId: null,
        validFrom: input.validFrom,
        validUntil: input.validUntil,
        isPrimary: true,
        status: 'active',
        reason: input.changeNote,
        createdByUserId: context.userId,
        approvedByUserId: context.userId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    }

    const versionNumber =
      (await this.workflowRepository.countAssignmentVersions(assignment.id)) + 1;
    const version: CommissionAssignmentVersion = {
      id: generateId('commission_assignment_version'),
      assignmentId: assignment.id,
      salesRepresentativeId: input.salesRepresentativeId,
      versionNumber,
      commissionPlanVersionId: planVersionId,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      ruleOverrides: normalizedOverrides,
      changeNote: input.changeNote,
      createdByUserId: context.userId,
      createdAt: timestamp,
    };
    try {
      await this.workflowRepository.createAssignmentVersion(version);

      assignment = { ...assignment, currentVersionId: version.id };
      await this.catalogRepository.saveAssignment(assignment);
    } catch (error) {
      return { ok: false, error: formatPersistError(error) };
    }

    void this.logCommissionEvent('commission_assignment_changed', context, {
      reason: input.changeNote || 'Provisionszuordnung geändert',
      metadata: {
        salesRepresentativeId: input.salesRepresentativeId,
        planVersionId,
      },
    }).catch((error) => {
      console.error(formatPersistError(error));
    });

    void this.auditService
      .logChange({
        context,
        action: 'commission_updated',
        entityType: 'commission_plan',
        entityId: assignment.id,
        summary: `Provisionszuordnung für ${input.salesRepresentativeId} gespeichert`,
      })
      .catch((error) => {
        console.error(formatPersistError(error));
      });

    return { ok: true, assignment };
  }

  async resetAssignmentOverrides(
    context: UserContext,
    salesRepresentativeId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const detail = await this.getAssignmentDetail(context, salesRepresentativeId);
    if ('error' in detail || !detail.assignment) {
      return { ok: false, error: 'not_found' };
    }

    return this.saveAssignment(context, {
      salesRepresentativeId,
      model: detail.model ?? 'classic',
      validFrom: detail.assignment.validFrom,
      validUntil: detail.assignment.validUntil,
      ruleOverrides: detail.standardOverrides,
      changeNote: 'Auf Standardmodell zurückgesetzt',
    }).then((result) => (result.ok ? { ok: true as const } : { ok: false as const, error: result.error }));
  }

  async previewAssignment(
    context: UserContext,
    input: CommissionCalculationInput & {
      model: 'classic' | 'variable';
      ruleOverrides: CommissionRuleOverride[];
    },
  ) {
    const guard = await this.requireAdmin(context);
    if (!guard.ok) {
      return { error: 'forbidden' as const };
    }

    const catalog = await this.catalogRepository.getCatalog();
    const planVersionId = resolvePlanVersionIdForModel(input.model);
    const rules = catalog.commissionRules.filter(
      (rule) => rule.commissionPlanVersionId === planVersionId,
    );

    const result = evaluateCommission(input, {
      commissionPlans: catalog.commissionPlans,
      commissionPlanVersions: catalog.commissionPlanVersions,
      commissionRules: rules,
      assignments: [
        {
          id: 'preview_assignment',
          salesRepresentativeId: input.salesRepresentativeId,
          commissionPlanVersionId: planVersionId,
          currentVersionId: null,
          validFrom: '2020-01-01',
          validUntil: null,
          isPrimary: true,
          status: 'active',
          reason: 'Preview',
          createdByUserId: context.userId,
          approvedByUserId: context.userId,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
      ],
      ruleOverrides: input.ruleOverrides,
    });

    return {
      result,
      model: input.model,
      planVersionId,
      appliedRules: result.components.map((component) => component.commissionRuleId),
      overrides: input.ruleOverrides,
    };
  }

  async getOverview(
    context: UserContext,
    filters?: {
      salesRepresentativeId?: string;
      status?: CommissionCaseStatus | 'all';
      model?: 'classic' | 'variable' | 'all';
    },
  ): Promise<
    | { rows: CommissionOverviewRow[]; summary: CommissionOverviewSummary; missingAssignments: number }
    | { error: 'forbidden' }
  > {
    const guard = await this.requireAdmin(context);
    if (!guard.ok) {
      return { error: 'forbidden' };
    }

    const [cases, users, catalog, bonuses, offers, calculations] = await Promise.all([
      this.calculationRepository.getAllCases(),
      this.userRepository.getAll(),
      this.catalogRepository.getCatalog(),
      this.workflowRepository.getBonusPayments(),
      this.offerRepository.getAll(),
      this.calculationRepository.getCalculations(),
    ]);

    const userById = new Map(users.map((user) => [user.id, user]));
    const offerById = new Map(offers.map((offer) => [offer.id, offer]));
    const calculationById = new Map(calculations.map((entry) => [entry.id, entry]));
    const ruleById = new Map(catalog.commissionRules.map((rule) => [rule.id, rule]));
    const assignmentRows = await this.listRepresentativeAssignments(context);
    const missingAssignments = Array.isArray(assignmentRows)
      ? assignmentRows.filter((row) => !row.assignmentId).length
      : 0;

    let rows: CommissionOverviewRow[] = cases.map((commissionCase) => {
      const offer = offerById.get(commissionCase.offerId);
      const rep = userById.get(commissionCase.salesRepresentativeId);
      const calc = catalog.assignments.find(
        (assignment) => assignment.salesRepresentativeId === commissionCase.salesRepresentativeId,
      );
      const model = calc
        ? resolveModelFromPlanVersion(
            calc.commissionPlanVersionId,
            catalog.commissionPlans,
            catalog.commissionPlanVersions,
          )
        : null;
      const calculation = calculationById.get(commissionCase.commissionCalculationId);
      const result = calculation?.result;
      const appliedRuleNames =
        result?.components
          .map((component) => {
            if (component.commissionRuleId) {
              return ruleById.get(component.commissionRuleId)?.name ?? component.label;
            }
            return component.label;
          })
          .filter(Boolean)
          .join(', ') || '—';
      const shareHints = (result?.findings ?? [])
        .map((finding) => finding.internalDescription)
        .filter((text) => text.includes('% vom Standard') || text.includes('Ausnahme'))
        .slice(0, 3);
      const componentShareSummary =
        result?.components
          .map((component) => {
            const match = component.internalExplanation.match(/\[(\d+)% vom Standard\]/);
            if (match) {
              return `${component.label}: ${match[1]} %`;
            }
            if (component.internalExplanation.includes('Ausnahme')) {
              return `${component.label}: Euro-Ausnahme`;
            }
            return `${component.label}: 100 %`;
          })
          .join('; ') || '100 %';

      return {
        caseId: commissionCase.id,
        salesRepresentativeId: commissionCase.salesRepresentativeId,
        salesRepresentativeName: rep?.name ?? commissionCase.salesRepresentativeId,
        customerName: offer
          ? getLeadDisplayName(offer.customerSnapshot)
          : '—',
        offerId: commissionCase.offerId,
        contractId: commissionCase.contractId,
        activationId: commissionCase.activationId,
        amountCents: commissionCase.approvedAmountCents - commissionCase.reductionAmountCents,
        model: model === 'classic' ? 'Classic' : model === 'variable' ? 'Variable' : '—',
        status: commissionCase.status,
        statusLabel: commissionBusinessStatusLabel(commissionCase.status),
        dueDate: commissionCase.dueDate,
        nextAction: this.nextActionForCase(commissionCase),
        standardLabel: model === 'classic' ? 'Classic' : model === 'variable' ? 'Variable' : '—',
        shareSummary: shareHints.length > 0 ? shareHints.join('; ') : componentShareSummary,
        endAmountCents: commissionCase.approvedAmountCents - commissionCase.reductionAmountCents,
        bonusAmountCents: result?.bonusAmountCents ?? 0,
        reductionAmountCents: commissionCase.reductionAmountCents,
        planVersionLabel:
          result?.commissionPlanVersionNumber != null
            ? `v${result.commissionPlanVersionNumber}`
            : result?.commissionPlanVersionId ?? '—',
        appliedRuleNames,
      };
    });

    if (filters?.salesRepresentativeId) {
      rows = rows.filter((row) => row.salesRepresentativeId === filters.salesRepresentativeId);
    }
    if (filters?.status && filters.status !== 'all') {
      rows = rows.filter((row) => row.status === filters.status);
    }
    if (filters?.model && filters.model !== 'all') {
      const label = filters.model === 'classic' ? 'Classic' : 'Variable';
      rows = rows.filter((row) => row.model === label);
    }

    const classicVersionId = resolvePlanVersionIdForModel('classic');
    const variableVersionId = resolvePlanVersionIdForModel('variable');
    const individualAgreementCount = Array.isArray(assignmentRows)
      ? assignmentRows.filter((row) => row.hasIndividualOverrides).length
      : 0;

    const summary: CommissionOverviewSummary = {
      calculatedCents: cases
        .filter((item) => item.status === 'expected')
        .reduce((sum, item) => sum + item.expectedAmountCents, 0),
      releasedCents: cases
        .filter((item) => item.status === 'released')
        .reduce((sum, item) => sum + item.approvedAmountCents, 0),
      settledCents: cases
        .filter((item) => item.status === 'settled')
        .reduce((sum, item) => sum + item.settledAmountCents, 0),
      paidCents: cases.reduce((sum, item) => sum + item.paidAmountCents, 0),
      bonusOpenCents: bonuses
        .filter((item) => item.status === 'open')
        .reduce((sum, item) => sum + item.amountCents, 0),
      bonusApprovedCents: bonuses
        .filter((item) => item.status === 'approved')
        .reduce((sum, item) => sum + item.amountCents, 0),
      bonusPaidCents: bonuses
        .filter((item) => item.status === 'paid')
        .reduce((sum, item) => sum + item.amountCents, 0),
      reductionCents: cases.reduce((sum, item) => sum + item.reductionAmountCents, 0),
      totalCents:
        cases.reduce((sum, item) => sum + item.paidAmountCents, 0) +
        bonuses.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amountCents, 0),
      classicRuleCount: catalog.commissionRules.filter(
        (rule) => rule.commissionPlanVersionId === classicVersionId && rule.status === 'active',
      ).length,
      variableRuleCount: catalog.commissionRules.filter(
        (rule) => rule.commissionPlanVersionId === variableVersionId && rule.status === 'active',
      ).length,
      individualAgreementCount,
      expectedCaseCount: cases.filter((item) => item.status === 'expected').length,
      pendingReleaseCaseCount: cases.filter((item) => item.status === 'reserved').length,
      releasedCaseCount: cases.filter((item) => item.status === 'released').length,
      settledCaseCount: cases.filter((item) => item.status === 'settled').length,
      paidCaseCount: cases.filter((item) => item.status === 'paid' || item.status === 'partially_paid')
        .length,
      bonusCount: bonuses.filter((item) => item.status !== 'cancelled').length,
    };

    return { rows, summary, missingAssignments };
  }

  /** Stellt sicher, dass jeder aktive Außendienst Classic mit 100 % ohne Pflichtpflege hat. */
  async ensureDefaultAssignments(context: UserContext): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
    const guard = await this.requireAdmin(context);
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const [users, catalog] = await Promise.all([
      this.userRepository.getAll(),
      this.catalogRepository.getCatalog(),
    ]);

    if (catalog.commissionRules.length === 0) {
      return { ok: false, error: 'no_catalog' };
    }

    let created = 0;
    for (const user of users.filter((entry) => entry.role === 'field_service' && entry.status === 'active')) {
      const existing = getActiveAssignmentForRepresentative(catalog.assignments, user.id, nowIso());
      if (existing) {
        continue;
      }
      const result = await this.saveAssignment(context, {
        salesRepresentativeId: user.id,
        model: 'classic',
        validFrom: '2026-01-01',
        validUntil: null,
        ruleOverrides: buildDefaultOverridesForRules(
          catalog.commissionRules.filter(
            (rule) =>
              rule.commissionPlanVersionId === resolvePlanVersionIdForModel('classic') &&
              rule.status === 'active',
          ),
        ),
        changeNote: 'Automatische Standardzuordnung 100 %',
      });
      if (result.ok) {
        created += 1;
      }
    }

    return { ok: true, created };
  }

  private nextActionForCase(commissionCase: CommissionCase): string {
    switch (commissionCase.status) {
      case 'expected':
        return 'Reservieren';
      case 'reserved':
        return 'Freigeben';
      case 'released':
        return 'Abrechnen';
      case 'settled':
      case 'partially_paid':
        return 'Auszahlung dokumentieren';
      default:
        return '—';
    }
  }

  async transitionCase(
    context: UserContext,
    caseId: string,
    targetStatus: CommissionCaseStatus,
    input?: {
      reductionAmountCents?: number;
      reductionReason?: string;
      accountingReference?: string;
      paymentDate?: string;
      paymentReference?: string;
      paymentAmountCents?: number;
      paymentNote?: string;
    },
  ): Promise<{ ok: true; commissionCase: CommissionCase } | { ok: false; error: string }> {
    const guard = await this.requireAdmin(context);
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const commissionCase = await this.workflowRepository.getCaseById(caseId);
    if (!commissionCase) {
      return { ok: false, error: 'not_found' };
    }

    if (targetStatus === 'released') {
      const prereq = await this.checkReleasePrerequisites(commissionCase.offerId);
      if (!prereq.ok) {
        return { ok: false, error: prereq.error };
      }
    }

    const timestamp = nowIso();
    const previousStatus = commissionCase.status;
    let updated: CommissionCase = { ...commissionCase, updatedAt: timestamp };

    if (targetStatus === 'reserved' && previousStatus === 'expected') {
      updated.status = 'reserved';
    } else if (targetStatus === 'released' && previousStatus === 'reserved') {
      updated.status = 'released';
    } else if (targetStatus === 'settled' && previousStatus === 'released') {
      updated.status = 'settled';
      updated.settledAmountCents = updated.approvedAmountCents - updated.reductionAmountCents;
      updated.accountingReference = input?.accountingReference ?? null;
    } else if (targetStatus === 'paid' && (previousStatus === 'settled' || previousStatus === 'partially_paid')) {
      const paymentAmount = input?.paymentAmountCents ?? updated.settledAmountCents - updated.paidAmountCents;
      updated.paidAmountCents += paymentAmount;
      updated.paymentReference = input?.paymentReference ?? null;
      updated.status =
        updated.paidAmountCents >= updated.settledAmountCents ? 'paid' : 'partially_paid';

      if (input?.paymentDate && input.paymentReference) {
        const payment: CommissionPaymentRecord = {
          id: generateId('commission_payment'),
          commissionCaseId: updated.id,
          amountCents: paymentAmount,
          currency: updated.currency,
          paymentDate: input.paymentDate,
          paymentReference: input.paymentReference,
          note: input.paymentNote ?? '',
          recordedByUserId: context.userId,
          createdAt: timestamp,
        };
        await this.workflowRepository.createPaymentRecord(payment);
      }
    } else if (targetStatus === 'cancelled') {
      updated.status = 'cancelled';
    } else if (input?.reductionAmountCents != null && input.reductionReason) {
      updated.reductionAmountCents = input.reductionAmountCents;
      updated.reductionReason = input.reductionReason;
      updated.approvedAmountCents = Math.max(
        0,
        updated.expectedAmountCents - updated.reductionAmountCents,
      );
    } else {
      return { ok: false, error: 'invalid_transition' };
    }

    updated = await this.workflowRepository.updateCase(updated);

    const eventType: CommissionEventType =
      targetStatus === 'released'
        ? 'commission_released'
        : targetStatus === 'settled'
          ? 'commission_accounted'
          : targetStatus === 'paid'
            ? 'commission_paid'
            : targetStatus === 'cancelled'
              ? 'commission_cancelled'
              : targetStatus === 'reserved'
                ? 'commission_reserved'
                : input?.reductionAmountCents != null
                  ? 'commission_reduced'
                  : 'commission_expected';

    await this.logCommissionEvent(eventType, context, {
      caseId: updated.id,
      previousStatus,
      newStatus: updated.status,
      amountCents: updated.approvedAmountCents,
      reason: input?.reductionReason ?? `Status geändert: ${previousStatus} → ${updated.status}`,
    });

    if (this.activityService && (targetStatus === 'released' || targetStatus === 'paid')) {
      const offer = await this.offerRepository.getById(updated.offerId);
      if (offer) {
        await this.activityService.recordSystemActivity(
          {
            type: targetStatus === 'released' ? 'commission_approved' : 'commission_paid',
            title:
              targetStatus === 'released' ? 'Provision freigegeben' : 'Provision ausgezahlt',
            description: '',
            leadId: offer.leadId,
            offerId: offer.id,
            contractId: updated.contractId,
            activationId: updated.activationId,
            sourceKey: `commission_${targetStatus}:${updated.id}:${updated.updatedAt}`,
          },
          context,
        );
      }
    }

    return { ok: true, commissionCase: updated };
  }

  async checkReleasePrerequisites(
    offerId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const offer = await this.offerRepository.getById(offerId);
    if (!offer) {
      return { ok: false, error: 'offer_missing' };
    }
    if (offer.workflowStatus !== 'accepted' && offer.workflowStatus !== 'activated') {
      return { ok: false, error: 'offer_not_accepted' };
    }

    const contracts = await this.contractRepository.getByOfferId(offerId);
    if (!contracts) {
      return { ok: false, error: 'contract_missing' };
    }

    const activation = await this.activationCaseRepository.getByContractId(contracts.id);
    if (!activation) {
      return { ok: false, error: 'activation_missing' };
    }

    const successfulActivation =
      activation.status === 'completed' || activation.status === 'live' ? activation : null;
    if (!successfulActivation) {
      return { ok: false, error: 'activation_missing' };
    }

    const blockers = await this.activationBlockerRepository.getByActivationId(successfulActivation.id);
    if (blockers.some((blocker) => blocker.status === 'open')) {
      return { ok: false, error: 'blockers_open' };
    }

    return { ok: true };
  }

  async createBonusPayment(
    context: UserContext,
    input: Omit<
      CommissionBonusPayment,
      'id' | 'status' | 'createdAt' | 'updatedAt' | 'approvedByUserId' | 'approvedAt' | 'paidAt' | 'paymentReference'
    >,
  ): Promise<{ ok: true; bonus: CommissionBonusPayment } | { ok: false; error: string }> {
    const guard = await this.requireAdmin(context);
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const timestamp = nowIso();
    const bonus: CommissionBonusPayment = {
      ...input,
      id: generateId('commission_bonus'),
      status: 'open',
      createdAt: timestamp,
      updatedAt: timestamp,
      approvedByUserId: null,
      approvedAt: null,
      paidAt: null,
      paymentReference: null,
    };

    const saved = await this.workflowRepository.createBonusPayment(bonus);
    await this.logCommissionEvent('commission_bonus_created', context, {
      reason: input.title,
      amountCents: input.amountCents,
      metadata: { bonusId: saved.id },
    });

    return { ok: true, bonus: saved };
  }

  async updateBonusStatus(
    context: UserContext,
    bonusId: string,
    status: CommissionBonusStatus,
    paymentReference?: string,
  ): Promise<{ ok: true; bonus: CommissionBonusPayment } | { ok: false; error: string }> {
    const guard = await this.requireAdmin(context);
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const bonuses = await this.workflowRepository.getBonusPayments();
    const bonus = bonuses.find((entry) => entry.id === bonusId);
    if (!bonus) {
      return { ok: false, error: 'not_found' };
    }

    const timestamp = nowIso();
    const updated: CommissionBonusPayment = {
      ...bonus,
      status,
      updatedAt: timestamp,
      approvedByUserId: status === 'approved' || status === 'paid' ? context.userId : bonus.approvedByUserId,
      approvedAt: status === 'approved' || status === 'paid' ? timestamp : bonus.approvedAt,
      paidAt: status === 'paid' ? timestamp : bonus.paidAt,
      paymentReference: paymentReference ?? bonus.paymentReference,
    };

    const saved = await this.workflowRepository.updateBonusPayment(updated);
    await this.logCommissionEvent(
      status === 'paid' ? 'commission_bonus_paid' : 'commission_bonus_changed',
      context,
      {
        reason: `Sonderzahlung ${status}`,
        amountCents: saved.amountCents,
        metadata: { bonusId: saved.id },
      },
    );

    return { ok: true, bonus: saved };
  }

  async getSalesOverview(
    context: UserContext,
  ): Promise<SalesCommissionSummary | { error: 'forbidden' }> {
    if (context.role !== 'field_service' && context.role !== 'admin') {
      return { error: 'forbidden' };
    }

    const repId = context.userId;
    const [cases, bonuses] = await Promise.all([
      this.calculationRepository.getAllCases(),
      this.workflowRepository.getBonusPaymentsByRepresentativeId(repId),
    ]);

    const ownCases = cases.filter((item) => item.salesRepresentativeId === repId);
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const yearKey = String(now.getFullYear());

    const monthCents = ownCases
      .filter((item) => item.updatedAt.startsWith(monthKey))
      .reduce((sum, item) => sum + item.paidAmountCents, 0);
    const yearCents = ownCases
      .filter((item) => item.updatedAt.startsWith(yearKey))
      .reduce((sum, item) => sum + item.paidAmountCents, 0);

    return {
      openCents: ownCases
        .filter((item) => item.status === 'expected' || item.status === 'reserved')
        .reduce((sum, item) => sum + item.approvedAmountCents, 0),
      expectedCents: ownCases
        .filter((item) => item.status === 'expected')
        .reduce((sum, item) => sum + item.expectedAmountCents, 0),
      releasedCents: ownCases
        .filter((item) => item.status === 'released')
        .reduce((sum, item) => sum + item.approvedAmountCents, 0),
      paidCents: ownCases.reduce((sum, item) => sum + item.paidAmountCents, 0),
      bonusCents: bonuses
        .filter((item) => item.status === 'paid')
        .reduce((sum, item) => sum + item.amountCents, 0),
      reductionCents: ownCases.reduce((sum, item) => sum + item.reductionAmountCents, 0),
      monthCents,
      yearCents,
      totalCents:
        ownCases.reduce((sum, item) => sum + item.paidAmountCents, 0) +
        bonuses.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amountCents, 0),
    };
  }

  async getEvents(context: UserContext) {
    const guard = await this.requireAdmin(context);
    if (!guard.ok) {
      return { error: 'forbidden' as const };
    }
    return this.workflowRepository.getEvents();
  }

  async getBonusPayments(context: UserContext) {
    const guard = await this.requireAdmin(context);
    if (!guard.ok) {
      return { error: 'forbidden' as const };
    }
    return this.workflowRepository.getBonusPayments();
  }

  async getPaymentHistory(context: UserContext) {
    const guard = await this.requireAdmin(context);
    if (!guard.ok) {
      return { error: 'forbidden' as const };
    }
    return this.workflowRepository.getPaymentHistory();
  }

  async exportOverviewCsv(context: UserContext): Promise<string | { error: 'forbidden' }> {
    const overview = await this.getOverview(context);
    if ('error' in overview) {
      return overview;
    }

    const header = 'Mitarbeiter;Kunde;Angebot;Status;Betrag;Modell';
    const lines = overview.rows.map(
      (row) =>
        `${row.salesRepresentativeName};${row.customerName};${row.offerId};${row.statusLabel};${(row.amountCents / 100).toFixed(2)};${row.model}`,
    );
    return [header, ...lines].join('\n');
  }

  normalizeLegacyCase(commissionCase: CommissionCase): CommissionCase {
    return {
      ...defaultCaseFields(),
      ...commissionCase,
    };
  }
}

export function normalizeCommissionCase(commissionCase: CommissionCase): CommissionCase {
  return {
    ...commissionCase,
    contractId: commissionCase.contractId ?? null,
    activationId: commissionCase.activationId ?? null,
    reductionAmountCents: commissionCase.reductionAmountCents ?? 0,
    reductionReason: commissionCase.reductionReason ?? null,
    accountingReference: commissionCase.accountingReference ?? null,
    paymentReference: commissionCase.paymentReference ?? null,
    dueDate: commissionCase.dueDate ?? null,
  };
}
