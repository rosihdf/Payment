import type { CommissionCalculationInput } from '../domain/commission/commissionCalculationInput';
import type { PricingEvaluationResult } from '../domain/pricing/pricingEvaluation';
import { PRICING_ENGINE_VERSION } from '../domain/pricing/pricingEvaluation';
import { evaluateCommission } from '../domain/commissionEngine/commissionCalculationEngine';
import type { UserContext } from '../domain/user/user';
import { nowIso } from '../utils/id';
import type { LocalCommissionCatalogRepository } from '../repositories/local/LocalCommissionCatalogRepository';
import type { AuditService } from './auditService';
import { requirePermission } from './auditService';
import { createDefaultCommissionCatalog } from './commissionCatalogSeed';

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
    await this.commissionCatalogRepository.saveCatalog({
      ...catalog,
      commissionPlans: seed.plans,
      commissionPlanVersions: seed.planVersions,
      commissionRules: seed.rules,
      assignments: [
        {
          id: 'commission_assignment_default',
          salesRepresentativeId: context.userId,
          commissionPlanVersionId: seed.planVersions[0]!.id,
          currentVersionId: null,
          validFrom: '2026-01-01',
          validUntil: null,
          isPrimary: true,
          status: 'active',
          reason: 'Standard',
          createdByUserId: context.userId,
          approvedByUserId: context.userId,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
      ],
    });

    await this.auditService.logChange({
      context,
      action: 'commission_activated',
      entityType: 'commission_plan',
      entityId: seed.plans[0]?.id ?? 'classic',
      summary: 'Standard-Provisionskatalog Classic/Variable aktiviert',
    });

    return { ok: true };
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

    return evaluateCommission(calculationInput, {
      commissionPlans: catalog.commissionPlans,
      commissionPlanVersions: catalog.commissionPlanVersions,
      commissionRules: catalog.commissionRules,
      assignments: catalog.assignments,
    });
  }
}
