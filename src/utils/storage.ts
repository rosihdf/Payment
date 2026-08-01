import { isSupabaseDataMode } from '../config/dataMode';

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
  offerCounselingConfirmations: 'amrtech.offerCounselingConfirmations',
  offerFollowUpPreferences: 'amrtech.offerFollowUpPreferences',
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
  commissionAssignmentVersions: 'amrtech.commissionAssignmentVersions',
  commissionBonusPayments: 'amrtech.commissionBonusPayments',
  commissionPaymentHistory: 'amrtech.commissionPaymentHistory',
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
  auditEntries: 'amrtech.auditEntries',
  auditStorageVersion: 'amrtech.auditStorageVersion',
  approvalRules: 'amrtech.approvalRules',
  approvalRuleStorageVersion: 'amrtech.approvalRuleStorageVersion',
  documentTemplates: 'amrtech.documentTemplates',
  documentTemplateStorageVersion: 'amrtech.documentTemplateStorageVersion',
  backupHistory: 'amrtech.backupHistory',
  exportHistory: 'amrtech.exportHistory',
  diagnosticEvents: 'amrtech.diagnosticEvents',
  userStorageVersion: 'amrtech.userStorageVersion',
  adminStorageVersion: 'amrtech.adminStorageVersion',
  contracts: 'amrtech.contracts',
  contractVersions: 'amrtech.contractVersions',
  contractTerminations: 'amrtech.contractTerminations',
  contractStorageVersion: 'amrtech.contractStorageVersion',
  activationCases: 'amrtech.activationCases',
  activationChecklists: 'amrtech.activationChecklists',
  activationApplications: 'amrtech.activationApplications',
  activationHardware: 'amrtech.activationHardware',
  activationBlockers: 'amrtech.activationBlockers',
  activationStorageVersion: 'amrtech.activationStorageVersion',
} as const;

const SUPABASE_PROD_ALLOWED_STORAGE_KEYS = new Set<string>([
  STORAGE_KEYS.leadDrafts,
  STORAGE_KEYS.leadEditDrafts,
]);

function assertStorageAccessAllowed(key: string): void {
  if (!isSupabaseDataMode() || !import.meta.env.PROD) {
    return;
  }

  if (SUPABASE_PROD_ALLOWED_STORAGE_KEYS.has(key)) {
    return;
  }

  throw new Error(
    `LocalStorage-Zugriff auf "${key}" ist im Supabase-Produktionsmodus nicht erlaubt. Persistente Daten müssen über Repositories gelesen werden.`,
  );
}

export function readStorageItem<T>(key: string): T | null {
  assertStorageAccessAllowed(key);
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
  assertStorageAccessAllowed(key);
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorageItem(key: string): void {
  localStorage.removeItem(key);
}
