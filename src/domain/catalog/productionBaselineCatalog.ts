import type { ApprovalRule } from '../approvalRule/approvalRule';
import type { SalesRepresentativeCommissionAssignment } from '../commission/commissionAssignment';
import type { CommissionPlan, CommissionPlanVersion } from '../commission/commissionPlan';
import type { CommissionRule } from '../commission/commissionRule';
import type { ContractTerm } from '../pricing/contractTerm';
import type { PriceBook, PriceBookVersion } from '../pricing/priceBook';
import type { PriceRule } from '../pricing/priceRule';
import type { Product } from '../product/product';
import type { RecommendationWeightSet } from '../recommendation/recommendationWeightSet';
import type { Tariff } from '../tariff/tariff';
import type { DocumentTemplate } from '../template/documentTemplate';
import { BESTPAY_PRODUCTS_RAW } from '../product/bestPayProducts';
import { normalizeProducts } from '../product/normalizeProduct';
import { BESTPAY_A920_TARIFFS_RAW } from '../tariff/bestPayTariffs';
import { normalizeTariffs } from '../tariff/normalizeTariff';
import { createDefaultCommissionCatalog } from '../../services/commissionCatalogSeed';
import { createProductionApprovalRules } from './approvalRuleCatalogSeed';
import { createProductionDocumentTemplates } from './documentTemplateCatalogSeed';
import { createProductionPricingCatalog } from './pricingCatalogSeed';
import { createProductionRecommendationWeightSet } from './recommendationCatalogSeed';

/** Kennzeichnung: produktive Ausgangskonfiguration aus belegten Domain-Quellen. */
export const PRODUCTION_BASELINE_CATALOG_VERSION = 1;

export interface ProductionBaselineCatalog {
  version: number;
  tariffs: Tariff[];
  products: Product[];
  commissionPlans: CommissionPlan[];
  commissionPlanVersions: CommissionPlanVersion[];
  commissionRules: CommissionRule[];
  approvalRules: ApprovalRule[];
  documentTemplates: DocumentTemplate[];
  recommendationWeightSets: RecommendationWeightSet[];
  priceBooks: PriceBook[];
  priceBookVersions: PriceBookVersion[];
  contractTerms: ContractTerm[];
  priceRules: PriceRule[];
}

export function createProductionBaselineCatalog(createdByUserId: string): ProductionBaselineCatalog {
  const commission = createDefaultCommissionCatalog(createdByUserId);
  const pricing = createProductionPricingCatalog();

  return {
    version: PRODUCTION_BASELINE_CATALOG_VERSION,
    tariffs: normalizeTariffs([...BESTPAY_A920_TARIFFS_RAW]),
    products: normalizeProducts([...BESTPAY_PRODUCTS_RAW]),
    commissionPlans: commission.plans,
    commissionPlanVersions: commission.planVersions,
    commissionRules: commission.rules,
    approvalRules: createProductionApprovalRules(createdByUserId),
    documentTemplates: createProductionDocumentTemplates(createdByUserId),
    recommendationWeightSets: [createProductionRecommendationWeightSet(createdByUserId)],
    ...pricing,
  };
}

export function createProductionCommissionAssignment(
  createdByUserId: string,
  commissionPlanVersionId: string,
): SalesRepresentativeCommissionAssignment {
  const timestamp = '2026-01-01T00:00:00.000Z';
  return {
    id: 'commission_assignment_production_default',
    salesRepresentativeId: createdByUserId,
    commissionPlanVersionId,
    currentVersionId: null,
    validFrom: '2026-01-01',
    validUntil: null,
    isPrimary: true,
    status: 'active',
    reason: 'Standard-Provisionszuordnung',
    createdByUserId,
    approvedByUserId: createdByUserId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
