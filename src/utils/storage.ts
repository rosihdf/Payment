export const STORAGE_KEYS = {
  users: 'amrtech.users',
  leads: 'amrtech.leads',
  tariffs: 'amrtech.tariffs',
  tariffCatalogVersion: 'amrtech.tariffCatalogVersion',
  products: 'amrtech.products',
  productCatalogVersion: 'amrtech.productCatalogVersion',
  currentUserId: 'amrtech.currentUserId',
  seeded: 'amrtech.seeded',
  leadDrafts: 'amrtech.leadDrafts',
  leadEditDrafts: 'amrtech.leadEditDrafts',
  offers: 'amrtech.offers',
  offerStorageVersion: 'amrtech.offerStorageVersion',
  offerVersions: 'amrtech.offerVersions',
  offerApprovals: 'amrtech.offerApprovals',
  offerDispatches: 'amrtech.offerDispatches',
  offerAcceptances: 'amrtech.offerAcceptances',
  offerDeclines: 'amrtech.offerDeclines',
  offerActivations: 'amrtech.offerActivations',
  salesDocuments: 'amrtech.salesDocuments',
  offerWorkflowStorageVersion: 'amrtech.offerWorkflowStorageVersion',
  offerDocuments: 'amrtech.offerDocuments',
  offerDocumentStorageVersion: 'amrtech.offerDocumentStorageVersion',
  priceBooks: 'amrtech.priceBooks',
  priceBookVersions: 'amrtech.priceBookVersions',
  contractTerms: 'amrtech.contractTerms',
  priceRules: 'amrtech.priceRules',
  pricingCatalogVersion: 'amrtech.pricingCatalogVersion',
  pricingEvaluations: 'amrtech.pricingEvaluations',
  pricingEvaluationStorageVersion: 'amrtech.pricingEvaluationStorageVersion',
  commissionPlans: 'amrtech.commissionPlans',
  commissionPlanVersions: 'amrtech.commissionPlanVersions',
  commissionRules: 'amrtech.commissionRules',
  commissionAssignments: 'amrtech.commissionAssignments',
  commissionCatalogVersion: 'amrtech.commissionCatalogVersion',
  commissionCalculations: 'amrtech.commissionCalculations',
  commissionCases: 'amrtech.commissionCases',
  commissionEvents: 'amrtech.commissionEvents',
  commissionCalculationStorageVersion: 'amrtech.commissionCalculationStorageVersion',
  recommendationWeightSets: 'amrtech.recommendationWeightSets',
  recommendationRecords: 'amrtech.recommendationRecords',
  recommendationCatalogVersion: 'amrtech.recommendationCatalogVersion',
  recommendationStorageVersion: 'amrtech.recommendationStorageVersion',
  billingImportSessions: 'amrtech.billingImportSessions',
  billingSourceDocuments: 'amrtech.billingSourceDocuments',
  billingExtractedFields: 'amrtech.billingExtractedFields',
  billingPeriodRecords: 'amrtech.billingPeriodRecords',
  customerCostBaselines: 'amrtech.customerCostBaselines',
  billingCostLineItems: 'amrtech.billingCostLineItems',
  billingImportStorageVersion: 'amrtech.billingImportStorageVersion',
  bestPayComparisonSessions: 'amrtech.bestPayComparisonSessions',
  bestPayComparisonStorageVersion: 'amrtech.bestPayComparisonStorageVersion',
  salesTasks: 'amrtech.salesTasks',
  salesTaskStorageVersion: 'amrtech.salesTaskStorageVersion',
  salesActivities: 'amrtech.salesActivities',
  salesActivityStorageVersion: 'amrtech.salesActivityStorageVersion',
} as const;

export function readStorageItem<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeStorageItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorageItem(key: string): void {
  localStorage.removeItem(key);
}
