import type { CommissionCalculationInput } from '../domain/commission/commissionCalculationInput';
import type { CommissionRule } from '../domain/commission/commissionRule';
import type { PricingEvaluationResult } from '../domain/pricing/pricingEvaluation';
import { PRICING_ENGINE_VERSION } from '../domain/pricing/pricingEvaluation';
import { evaluateCommission } from '../domain/commissionEngine/commissionCalculationEngine';
import type { UserContext } from '../domain/user/user';
import { generateId, nowIso } from '../utils/id';
import type { LocalCommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import type { AuditService } from './auditService';
import { requirePermission } from './auditService';
import {
  createDefaultCommissionCatalog,
  DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID,
} from './commissionCatalogSeed';
import {
  COMMISSION_SHARE_DEFAULT,
  isValidCommissionSharePercent,
} from '../domain/commission/commissionShare';
import { formatPersistError } from '../utils/persistError';

export interface CommissionPreviewInput {
  contractTypeCode: string;
  termMonths: number;
  transactionVolumeCents: number;
  clearingVolumeCents: number;
  terminalRentalCents: number;
  accessorySaleCents: number;
}

function buildPreviewPricingResult(termMonths: number): PricingEvaluationResult {
  return {
    evaluationId: 'preview',
    evaluatedAt: nowIso(),
    engineVersion: PRICING_ENGINE_VERSION,
    inputFingerprint: 'preview',
    priceBookVersionId: null,
    priceBookVersionNumber: null,
    appliedRules: [],
    rejectedRules: [],
    listPriceCents: null,
    targetPriceCents: null,
    minimumPriceCents: null,
    maxDiscountPercentTenths: null,
    recommendedPriceCents: null,
    requestedPriceCents: null,
    evaluatedPriceCents: null,
    absoluteDeviationCents: null,
    percentDeviationTenths: null,
    currency: 'EUR',
    unit: 'month',
    termMonths,
    isStandardTerm: termMonths === 36,
    isSpecialTerm: termMonths !== 36,
    termAllowed: true,
    specialTermReason: '',
    reviewClass: 'standard',
    approval: {
      reviewClass: 'standard',
      adminReviewRequired: true,
      quickReviewPossible: true,
      detailReviewRequired: false,
      approvalBlocked: false,
      requiredAdminRole: 'admin',
      reasons: [],
      warnings: [],
      violations: [],
      requiredJustifications: [],
      priceSummary: '',
      termSummary: '',
      configurationSummary: '',
      internalRecommendation: '',
    },
    findings: [],
    snapshot: {
      schemaVersion: 1,
      engineVersion: PRICING_ENGINE_VERSION,
      evaluatedAt: nowIso(),
      input: {
        evaluationDate: nowIso(),
        salesRepresentativeId: 'preview',
        leadId: null,
        offerId: null,
        currency: 'EUR',
        contractTypeId: null,
        productId: null,
        tariffId: null,
        hardwareProductIds: [],
        accessoryItems: [],
        contractTermId: null,
        requestedSpecialTermMonths: termMonths,
        specialTermReason: '',
        quantity: 1,
        annualCardVolumeCents: null,
        monthlyCardVolumeCents: null,
        transactionCount: null,
        averageTicketCents: null,
        girocardSharePercent: null,
        creditCardSharePercent: null,
        industryId: null,
        requestedUnitPriceCents: null,
        requestedTotalPriceCents: null,
        manualPriceOverride: false,
        overrideReason: '',
      },
      priceBookVersionId: null,
      priceBookVersionNumber: null,
      contractTermMonths: termMonths,
      appliedRuleIds: [],
      rejectedRuleIds: [],
      positions: [],
      findings: [],
      reviewClass: 'standard',
    },
    stale: false,
  };
}

export class CommissionCatalogAdminService {
  private readonly commissionCatalogRepository: LocalCommissionCatalogRepository;
  private readonly auditService: AuditService;

  constructor(
    commissionCatalogRepository: LocalCommissionCatalogRepository,
    auditService: AuditService,
  ) {
    this.commissionCatalogRepository = commissionCatalogRepository;
    this.auditService = auditService;
  }

  async getCatalog(context: UserContext) {
    const guard = requirePermission(context, 'admin.commission');
    if (!guard.ok) {
      return { error: 'forbidden' as const };
    }
    return this.commissionCatalogRepository.getCatalog();
  }

  async seedDefaultCatalog(context: UserContext): Promise<{ ok: true } | { ok: false; error: 'forbidden' }> {
    const guard = requirePermission(context, 'admin.commission');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const seed = createDefaultCommissionCatalog(context.userId);
    const catalog = await this.commissionCatalogRepository.getCatalog();

    if (catalog.commissionPlans.length === 0 && catalog.commissionRules.length === 0) {
      await this.commissionCatalogRepository.saveCatalog({
        ...catalog,
        commissionPlans: seed.plans,
        commissionPlanVersions: seed.planVersions,
        commissionRules: seed.rules,
        assignments: catalog.assignments,
      });
    } else {
      const planById = new Map(catalog.commissionPlans.map((plan) => [plan.id, plan]));
      for (const plan of seed.plans) {
        if (!planById.has(plan.id)) {
          planById.set(plan.id, plan);
        }
      }
      const versionById = new Map(
        catalog.commissionPlanVersions.map((version) => [version.id, version]),
      );
      for (const version of seed.planVersions) {
        if (!versionById.has(version.id)) {
          versionById.set(version.id, version);
        }
      }
      const ruleById = new Map(catalog.commissionRules.map((rule) => [rule.id, rule]));
      for (const rule of seed.rules) {
        if (!ruleById.has(rule.id)) {
          ruleById.set(rule.id, rule);
        }
      }
      await this.commissionCatalogRepository.saveCatalog({
        ...catalog,
        commissionPlans: Array.from(planById.values()),
        commissionPlanVersions: Array.from(versionById.values()),
        commissionRules: Array.from(ruleById.values()),
      });
    }

    await this.auditService.logChange({
      context,
      action: 'commission_activated',
      entityType: 'commission_plan',
      entityId: seed.plans[0]?.id ?? 'classic',
      summary: 'Standard-Provisionskatalog Classic/Variable aktiviert bzw. ergänzt',
    });

    return { ok: true };
  }

  /**
   * Speichert/aktualisiert eine Standardprovisionsregel.
   * fixedAmountCents = Standardbetrag (100 %). displaySharePercent steuert die Anzeige.
   */
  async upsertStandardRule(
    context: UserContext,
    input: {
      id?: string;
      commissionPlanVersionId: string;
      name: string;
      internalDescription: string;
      status: 'active' | 'inactive';
      commissionType: CommissionRule['commissionType'];
      calculationBasis: CommissionRule['calculationBasis'];
      contractTypeCode: string | null;
      fixedAmountCents: number | null;
      percentTenthsOfBasisPoint: number | null;
      displaySharePercent?: number;
      validFrom: string | null;
      validUntil: string | null;
      minTermMonthsExclusive?: number | null;
      maxTermMonthsExclusive?: number | null;
      accessoryOnly?: boolean;
      priority?: number;
      combinable?: boolean;
    },
  ): Promise<{ ok: true; rule: CommissionRule } | { ok: false; error: string }> {
    const guard = requirePermission(context, 'admin.commission');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const name = input.name.trim();
    if (!name) {
      return { ok: false, error: 'validation' };
    }

    const share = input.displaySharePercent ?? COMMISSION_SHARE_DEFAULT;
    if (!isValidCommissionSharePercent(share)) {
      return { ok: false, error: 'share_range' };
    }

    const catalog = await this.commissionCatalogRepository.getCatalog();
    const timestamp = nowIso();
    const existing = input.id
      ? catalog.commissionRules.find((rule) => rule.id === input.id)
      : undefined;

    // Standardbetrag wird immer als 100%-Basis gespeichert.
    const rule: CommissionRule = {
      id: existing?.id ?? input.id ?? generateId('commission_rule'),
      commissionPlanVersionId: input.commissionPlanVersionId,
      name,
      status: input.status,
      commissionType: input.commissionType,
      calculationBasis: input.calculationBasis,
      contractTypeCode: input.contractTypeCode,
      productId: existing?.productId ?? null,
      tariffId: existing?.tariffId ?? null,
      contractTermId: existing?.contractTermId ?? null,
      accessoryOnly: input.accessoryOnly ?? existing?.accessoryOnly ?? false,
      minTermMonthsExclusive: input.minTermMonthsExclusive ?? existing?.minTermMonthsExclusive ?? null,
      maxTermMonthsExclusive: input.maxTermMonthsExclusive ?? existing?.maxTermMonthsExclusive ?? null,
      exactTermMonths: existing?.exactTermMonths ?? null,
      priority: input.priority ?? existing?.priority ?? 10,
      combinable: input.combinable ?? existing?.combinable ?? true,
      fixedAmountCents: input.fixedAmountCents,
      percentTenthsOfBasisPoint: input.percentTenthsOfBasisPoint,
      thresholdTenthsOfCent: existing?.thresholdTenthsOfCent ?? null,
      currency: 'EUR',
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      internalDescription: input.internalDescription.trim(),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    const rules = existing
      ? catalog.commissionRules.map((entry) => (entry.id === rule.id ? rule : entry))
      : [...catalog.commissionRules, rule];

    try {
      await this.commissionCatalogRepository.saveRules(rules);
    } catch (error) {
      return { ok: false, error: formatPersistError(error) };
    }

    try {
      await this.auditService.logChange({
        context,
        action: 'commission_updated',
        entityType: 'commission_plan',
        entityId: rule.id,
        summary: `Standardregel „${rule.name}“ gespeichert`,
        changes: [
          {
            field: 'fixedAmountCents',
            before: existing?.fixedAmountCents != null ? String(existing.fixedAmountCents) : null,
            after: rule.fixedAmountCents != null ? String(rule.fixedAmountCents) : null,
          },
        ],
      });
    } catch (error) {
      console.error(formatPersistError(error));
    }

    return { ok: true, rule };
  }

  async previewCommission(context: UserContext, input: CommissionPreviewInput) {
    const guard = requirePermission(context, 'admin.commission');
    if (!guard.ok) {
      return { error: 'forbidden' as const };
    }

    const catalog = await this.commissionCatalogRepository.getCatalog();
    const calculationInput: CommissionCalculationInput = {
      evaluationDate: nowIso(),
      offerId: 'admin_preview',
      offerVersionKey: 'preview',
      salesRepresentativeId: context.userId,
      pricingEvaluationRecordId: 'preview',
      pricingEvaluationResult: buildPreviewPricingResult(input.termMonths),
      contractTypeCode: input.contractTypeCode,
      accessoryItems:
        input.accessorySaleCents > 0
          ? [{ productId: 'accessory_preview', quantity: 1, salePriceCents: input.accessorySaleCents }]
          : [],
    };

    const hasAssignment = catalog.assignments.some(
      (assignment) =>
        assignment.salesRepresentativeId === context.userId &&
        assignment.status === 'active' &&
        assignment.isPrimary,
    );

    // Vorschau nutzt ohne Pflege Classic 100 % (Unternehmensstandard).
    const assignments = hasAssignment
      ? catalog.assignments
      : [
          ...catalog.assignments,
          {
            id: 'commission_assignment_preview_default',
            salesRepresentativeId: context.userId,
            commissionPlanVersionId: DEFAULT_COMMISSION_PLAN_VERSION_CLASSIC_ID,
            currentVersionId: null,
            validFrom: '2020-01-01',
            validUntil: null,
            isPrimary: true,
            status: 'active' as const,
            reason: 'Vorschau Standard 100 %',
            createdByUserId: context.userId,
            approvedByUserId: context.userId,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          },
        ];

    return evaluateCommission(calculationInput, {
      commissionPlans: catalog.commissionPlans,
      commissionPlanVersions: catalog.commissionPlanVersions,
      commissionRules: catalog.commissionRules,
      assignments,
    });
  }
}
