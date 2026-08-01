import { BACKUP_FORMAT_VERSION } from '../domain/backup/backupManifest';
import {
  normalizeActivationApplications,
  normalizeActivationBlockers,
  normalizeActivationCases,
  normalizeActivationChecklistItems,
  normalizeActivationHardwareList,
} from '../domain/activation/normalizeActivation';
import { normalizeApprovalRules } from '../domain/approvalRule/normalizeApprovalRule';
import { normalizeAuditEntries } from '../domain/audit/normalizeAuditEntry';
import type { BillingCostLineItem } from '../domain/billingImport/billingCostLineItem';
import type { BillingImportSession } from '../domain/billingImport/billingImportSession';
import type { BillingPeriodRecord } from '../domain/billingImport/billingPeriodRecord';
import type { CustomerCostBaseline } from '../domain/billingImport/customerCostBaseline';
import type { ExtractedBillingField } from '../domain/billingImport/extractedBillingField';
import type { BestPayComparisonSession } from '../domain/bestPayComparison/bestPayComparisonSession';
import type { CommissionCalculationRecord } from '../domain/commission/commissionCalculation';
import {
  normalizeContracts,
  normalizeContractTerminations,
  normalizeContractVersions,
} from '../domain/contract/normalizeContract';
import { normalizeDocumentTemplates } from '../domain/template/normalizeDocumentTemplate';
import { normalizeLeads } from '../domain/lead/normalizeLead';
import { normalizeOfferDocuments } from '../domain/offerDocument/normalizeOfferDocument';
import { normalizeOffers } from '../domain/offer/normalizeOffer';
import { normalizeOfferVersions } from '../domain/offer/normalizeOfferVersion';
import { normalizeOfferWorkflowEvents } from '../domain/offer/normalizeOfferWorkflowEvents';
import { normalizePricingEvaluationRecords } from '../domain/pricing/normalizePricingEvaluationRecord';
import { normalizeContractTerms } from '../domain/pricing/normalizeContractTerm';
import { normalizePriceBookVersions, normalizePriceBooks } from '../domain/pricing/normalizePriceBook';
import { normalizePriceRules } from '../domain/pricing/normalizePriceRule';
import { normalizeProducts } from '../domain/product/normalizeProduct';
import { normalizeRecommendationRecords } from '../domain/recommendation/normalizeRecommendationRecord';
import { normalizeRecommendationWeightSets } from '../domain/recommendation/normalizeRecommendationRecord';
import { normalizeSalesDocuments } from '../domain/salesDocument/normalizeSalesDocument';
import type { SalesActivity } from '../domain/salesWorkspace/salesActivity';
import type { SalesTask } from '../domain/salesWorkspace/salesTask';
import { normalizeTariffs } from '../domain/tariff/normalizeTariff';
import type { UserContext } from '../domain/user/user';
import { normalizeUsers } from '../domain/user/normalizeUser';
import { isSupabaseDataMode } from '../config/dataMode';
import { createCoreRepositories } from '../app/providers/createCoreRepositories';
import { createOperationalRepositories } from '../repositories/supabase/createOperationalRepositories';
import { getSupabaseClient } from '../lib/supabaseClient';
import { generateId, nowIso } from '../utils/id';
import { FULL_BACKUP_KEYS } from './dataExportService';
import { STORAGE_KEYS } from '../utils/storage';
import type { AuditService } from './auditService';
import { requirePermission } from './auditService';
import { sbSelectAll, sbUpsertMany } from '../repositories/supabase/supabaseTable';
import type { OfferWorkflowEvent } from '../domain/offer/offerWorkflowEvents';
import { normalizeBestPayComparisonSession } from './bestPayComparisonStorageMigration';
import { normalizeSalesActivity, normalizeSalesTask } from './salesWorkspaceStorageMigration';

const EXCLUDED_STORAGE_KEYS = new Set<string>([
  STORAGE_KEYS.billingSourceDocuments,
  STORAGE_KEYS.leadDrafts,
  STORAGE_KEYS.leadEditDrafts,
  STORAGE_KEYS.seeded,
  STORAGE_KEYS.currentUserId,
  STORAGE_KEYS.backupHistory,
  STORAGE_KEYS.exportHistory,
  STORAGE_KEYS.diagnosticEvents,
]);

const WORKFLOW_EVENT_KEYS = [
  STORAGE_KEYS.offerApprovals,
  STORAGE_KEYS.offerDispatches,
  STORAGE_KEYS.offerAcceptances,
  STORAGE_KEYS.offerDeclines,
  STORAGE_KEYS.offerActivations,
  STORAGE_KEYS.offerCounselingConfirmations,
  STORAGE_KEYS.offerFollowUpPreferences,
] as const;

export interface MigrationAreaPreview {
  areaKey: string;
  label: string;
  recordCount: number;
  conflictCount: number;
  skipped: boolean;
  skipReason?: string;
}

export interface MigrationPreview {
  valid: boolean;
  source: 'backup' | 'localStorage';
  areas: MigrationAreaPreview[];
  conflicts: string[];
  warnings: string[];
  recordCounts: Record<string, number>;
  runId: string;
}

export type MigrationImportResult =
  | {
      ok: true;
      runId: string;
      importedCounts: Record<string, number>;
    }
  | {
      ok: false;
      error: 'forbidden' | 'invalid_mode' | 'invalid_payload' | 'failed';
      message?: string;
      runId?: string;
    };

interface MigrationPayload {
  source: 'backup' | 'localStorage';
  payload: Record<string, unknown>;
}

type AreaImporter = (payload: Record<string, unknown>) => Promise<number>;

interface MigrationAreaConfig {
  key: string;
  label: string;
  order: number;
  table?: string;
  sourceKeys?: string[];
  conflictBySourceKey?: boolean;
  importArea: AreaImporter;
}

function readLocalStoragePayload(): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of FULL_BACKUP_KEYS) {
    if (EXCLUDED_STORAGE_KEYS.has(key) || key.includes('Version')) {
      continue;
    }
    const raw = localStorage.getItem(key);
    if (!raw) {
      continue;
    }
    try {
      payload[key] = JSON.parse(raw) as unknown;
    } catch {
      payload[key] = null;
    }
  }
  return payload;
}

function parseBackupContent(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content) as { manifest?: { formatVersion?: number }; payload?: Record<string, unknown> };
    if (!parsed.payload || parsed.manifest?.formatVersion !== BACKUP_FORMAT_VERSION) {
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

function readArray(payload: Record<string, unknown>, key: string): unknown[] {
  const value = payload[key];
  return Array.isArray(value) ? value : [];
}

function readTypedArray<T>(payload: Record<string, unknown>, key: string): T[] {
  return readArray(payload, key) as T[];
}

function normalizeBestPayComparisonSessions(values: unknown[]): BestPayComparisonSession[] {
  return values
    .map((value) => normalizeBestPayComparisonSession(value))
    .filter((value): value is BestPayComparisonSession => value !== null);
}

function normalizeSalesTasks(values: unknown[]): SalesTask[] {
  return values
    .map((value) => normalizeSalesTask(value))
    .filter((value): value is SalesTask => value !== null);
}

function normalizeSalesActivities(values: unknown[]): SalesActivity[] {
  return values
    .map((value) => normalizeSalesActivity(value))
    .filter((value): value is SalesActivity => value !== null);
}

function eventToRow(event: OfferWorkflowEvent): Record<string, unknown> {
  return {
    id: event.id,
    offer_id: event.offerId,
    event_type: event.type,
    created_by_user_id: event.createdByUserId,
    data: event,
    created_at: event.createdAt,
  };
}

function buildMigrationAreas(repositories: ReturnType<typeof createOperationalRepositories> & ReturnType<typeof createCoreRepositories>): MigrationAreaConfig[] {
  return [
    {
      key: STORAGE_KEYS.users,
      label: 'Benutzer',
      order: 10,
      table: 'profiles',
      importArea: async (payload) => {
        const users = normalizeUsers(readArray(payload, STORAGE_KEYS.users));
        if (users.length === 0) {
          return 0;
        }
        await repositories.userRepository.saveAll(users);
        return users.length;
      },
    },
    {
      key: STORAGE_KEYS.tariffs,
      label: 'Tarife',
      order: 20,
      table: 'tariffs',
      importArea: async (payload) => {
        const items = normalizeTariffs(readArray(payload, STORAGE_KEYS.tariffs));
        for (const item of items) {
          const existing = await repositories.tariffRepository.getById(item.id);
          if (existing) {
            await repositories.tariffRepository.update(item);
          } else {
            await repositories.tariffRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.products,
      label: 'Produkte',
      order: 30,
      table: 'products',
      importArea: async (payload) => {
        const items = normalizeProducts(readArray(payload, STORAGE_KEYS.products));
        for (const item of items) {
          const existing = await repositories.productRepository.getById(item.id);
          if (existing) {
            await repositories.productRepository.update(item);
          } else {
            await repositories.productRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: 'pricing_catalog',
      label: 'Preiskatalog',
      order: 40,
      importArea: async (payload) => {
        const catalog = {
          priceBooks: normalizePriceBooks(readArray(payload, STORAGE_KEYS.priceBooks)),
          priceBookVersions: normalizePriceBookVersions(readArray(payload, STORAGE_KEYS.priceBookVersions)),
          contractTerms: normalizeContractTerms(readArray(payload, STORAGE_KEYS.contractTerms)),
          priceRules: normalizePriceRules(readArray(payload, STORAGE_KEYS.priceRules)),
        };
        await repositories.pricingCatalogRepository.saveCatalog(catalog);
        return (
          catalog.priceBooks.length +
          catalog.priceBookVersions.length +
          catalog.contractTerms.length +
          catalog.priceRules.length
        );
      },
    },
    {
      key: 'commission_catalog',
      label: 'Provisionskatalog',
      order: 50,
      importArea: async (payload) => {
        const catalog = await repositories.commissionCatalogRepository.getCatalog();
        const next = {
          commissionPlans: readArray(payload, STORAGE_KEYS.commissionPlans),
          commissionPlanVersions: readArray(payload, STORAGE_KEYS.commissionPlanVersions),
          commissionRules: readArray(payload, STORAGE_KEYS.commissionRules),
          assignments: readArray(payload, STORAGE_KEYS.commissionAssignments),
        };
        await repositories.commissionCatalogRepository.saveCatalog({
          ...catalog,
          commissionPlans: next.commissionPlans.length ? next.commissionPlans as typeof catalog.commissionPlans : catalog.commissionPlans,
          commissionPlanVersions: next.commissionPlanVersions.length ? next.commissionPlanVersions as typeof catalog.commissionPlanVersions : catalog.commissionPlanVersions,
          commissionRules: next.commissionRules.length ? next.commissionRules as typeof catalog.commissionRules : catalog.commissionRules,
          assignments: next.assignments.length ? next.assignments as typeof catalog.assignments : catalog.assignments,
        });
        return (
          next.commissionPlans.length +
          next.commissionPlanVersions.length +
          next.commissionRules.length +
          next.assignments.length
        );
      },
    },
    {
      key: STORAGE_KEYS.recommendationWeightSets,
      label: 'Empfehlungsgewichte',
      order: 60,
      table: 'recommendation_weight_sets',
      importArea: async (payload) => {
        const items = normalizeRecommendationWeightSets(readArray(payload, STORAGE_KEYS.recommendationWeightSets));
        await sbUpsertMany(
          'recommendation_weight_sets',
          items.map((item) => ({
            id: item.id,
            data: item,
            created_at: item.createdAt,
            updated_at: item.updatedAt,
          })),
        );
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.approvalRules,
      label: 'Freigaberegeln',
      order: 70,
      table: 'approval_rules',
      importArea: async (payload) => {
        const items = normalizeApprovalRules(readArray(payload, STORAGE_KEYS.approvalRules));
        if (items.length === 0) {
          return 0;
        }
        await repositories.approvalRuleRepository.saveAll(items);
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.documentTemplates,
      label: 'Dokumentvorlagen',
      order: 80,
      table: 'document_templates',
      importArea: async (payload) => {
        const items = normalizeDocumentTemplates(readArray(payload, STORAGE_KEYS.documentTemplates));
        if (items.length === 0) {
          return 0;
        }
        await repositories.documentTemplateRepository.saveAll(items);
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.leads,
      label: 'Leads',
      order: 100,
      table: 'leads',
      importArea: async (payload) => {
        const items = normalizeLeads(readArray(payload, STORAGE_KEYS.leads));
        for (const item of items) {
          const existing = await repositories.leadRepository.getById(item.id);
          if (existing) {
            await repositories.leadRepository.update(item);
          } else {
            await repositories.leadRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.offers,
      label: 'Angebote',
      order: 110,
      table: 'offers',
      importArea: async (payload) => {
        const items = normalizeOffers(readArray(payload, STORAGE_KEYS.offers));
        for (const item of items) {
          const existing = await repositories.offerRepository.getById(item.id);
          if (existing) {
            await repositories.offerRepository.update(item);
          } else {
            await repositories.offerRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.offerVersions,
      label: 'Angebotsversionen',
      order: 120,
      table: 'offer_versions',
      importArea: async (payload) => {
        const items = normalizeOfferVersions(readArray(payload, STORAGE_KEYS.offerVersions));
        for (const item of items) {
          const existing = await repositories.offerVersionRepository.getById(item.id);
          if (existing) {
            await repositories.offerVersionRepository.update(item);
          } else {
            await repositories.offerVersionRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: 'offer_workflow_events',
      label: 'Angebots-Workflow-Ereignisse',
      order: 130,
      table: 'offer_workflow_events',
      importArea: async (payload) => {
        const events = WORKFLOW_EVENT_KEYS.flatMap((key) =>
          normalizeOfferWorkflowEvents(readArray(payload, key)),
        );
        await sbUpsertMany('offer_workflow_events', events.map(eventToRow));
        return events.length;
      },
    },
    {
      key: STORAGE_KEYS.offerDocuments,
      label: 'Angebotsdokumente',
      order: 140,
      table: 'offer_documents',
      importArea: async (payload) => {
        const items = normalizeOfferDocuments(readArray(payload, STORAGE_KEYS.offerDocuments));
        for (const item of items) {
          const existing = await repositories.offerDocumentRepository.getById(item.id);
          if (!existing) {
            await repositories.offerDocumentRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.salesDocuments,
      label: 'Vertriebsdokumente',
      order: 150,
      table: 'sales_documents',
      importArea: async (payload) => {
        const items = normalizeSalesDocuments(readArray(payload, STORAGE_KEYS.salesDocuments));
        const existing = await repositories.salesDocumentRepository.getAll();
        const existingIds = new Set(existing.map((entry) => entry.id));
        for (const item of items) {
          if (!existingIds.has(item.id)) {
            await repositories.salesDocumentRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.pricingEvaluations,
      label: 'Preisauswertungen',
      order: 160,
      table: 'pricing_evaluations',
      importArea: async (payload) => {
        const items = normalizePricingEvaluationRecords(readArray(payload, STORAGE_KEYS.pricingEvaluations));
        for (const item of items) {
          const existing = await repositories.pricingEvaluationRepository.getById(item.id);
          if (existing) {
            await repositories.pricingEvaluationRepository.update(item);
          } else {
            await repositories.pricingEvaluationRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.commissionCalculations,
      label: 'Provisionsberechnungen',
      order: 170,
      table: 'commission_calculations',
      importArea: async (payload) => {
        const items = readTypedArray<CommissionCalculationRecord>(payload, STORAGE_KEYS.commissionCalculations);
        for (const item of items) {
          const existing = await repositories.commissionCalculationRepository.getCalculationById(item.id);
          if (existing) {
            await repositories.commissionCalculationRepository.updateCalculation(item);
          } else {
            await repositories.commissionCalculationRepository.createCalculation(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.recommendationRecords,
      label: 'Empfehlungen',
      order: 180,
      table: 'recommendation_records',
      importArea: async (payload) => {
        const items = normalizeRecommendationRecords(readArray(payload, STORAGE_KEYS.recommendationRecords));
        for (const item of items) {
          await repositories.recommendationRepository.saveRecord(item);
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.bestPayComparisonSessions,
      label: 'BestPay-Vergleiche',
      order: 190,
      table: 'best_pay_comparison_sessions',
      importArea: async (payload) => {
        const items = normalizeBestPayComparisonSessions(
          readArray(payload, STORAGE_KEYS.bestPayComparisonSessions),
        );
        for (const item of items) {
          await repositories.bestPayComparisonRepository.save(item);
        }
        return items.length;
      },
    },
    {
      key: 'billing_metadata',
      label: 'Abrechnungsimport (Metadaten)',
      order: 200,
      importArea: async (payload) => {
        const store = {
          sessions: readTypedArray<BillingImportSession>(payload, STORAGE_KEYS.billingImportSessions),
          documents: [],
          fields: readTypedArray<ExtractedBillingField>(payload, STORAGE_KEYS.billingExtractedFields),
          periods: readTypedArray<BillingPeriodRecord>(payload, STORAGE_KEYS.billingPeriodRecords),
          baselines: readTypedArray<CustomerCostBaseline>(payload, STORAGE_KEYS.customerCostBaselines),
          costLineItems: readTypedArray<BillingCostLineItem>(payload, STORAGE_KEYS.billingCostLineItems),
        };
        await repositories.billingImportRepository.writeStore(store);
        return (
          store.sessions.length +
          store.fields.length +
          store.periods.length +
          store.baselines.length +
          store.costLineItems.length
        );
      },
    },
    {
      key: STORAGE_KEYS.contracts,
      label: 'Verträge',
      order: 210,
      table: 'contracts',
      conflictBySourceKey: true,
      importArea: async (payload) => {
        const items = normalizeContracts(readArray(payload, STORAGE_KEYS.contracts));
        for (const item of items) {
          const bySource = await repositories.contractRepository.getBySourceKey(item.sourceKey);
          const existing = bySource ?? (await repositories.contractRepository.getById(item.id));
          if (existing) {
            await repositories.contractRepository.update({ ...item, id: existing.id });
          } else {
            await repositories.contractRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.contractVersions,
      label: 'Vertragsversionen',
      order: 220,
      table: 'contract_versions',
      importArea: async (payload) => {
        const items = normalizeContractVersions(readArray(payload, STORAGE_KEYS.contractVersions));
        for (const item of items) {
          const existing = await repositories.contractVersionRepository.getById(item.id);
          if (existing) {
            await repositories.contractVersionRepository.update(item);
          } else {
            await repositories.contractVersionRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.contractTerminations,
      label: 'Vertragskündigungen',
      order: 230,
      table: 'contract_terminations',
      importArea: async (payload) => {
        const items = normalizeContractTerminations(readArray(payload, STORAGE_KEYS.contractTerminations));
        for (const item of items) {
          const existing = await repositories.contractTerminationRepository.getById(item.id);
          if (existing) {
            await repositories.contractTerminationRepository.update(item);
          } else {
            await repositories.contractTerminationRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.activationCases,
      label: 'Aktivierungen',
      order: 240,
      table: 'activation_cases',
      conflictBySourceKey: true,
      importArea: async (payload) => {
        const items = normalizeActivationCases(readArray(payload, STORAGE_KEYS.activationCases));
        for (const item of items) {
          const bySource = await repositories.activationCaseRepository.getBySourceKey(item.sourceKey);
          const existing = bySource ?? (await repositories.activationCaseRepository.getById(item.id));
          if (existing) {
            await repositories.activationCaseRepository.update({ ...item, id: existing.id });
          } else {
            await repositories.activationCaseRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.activationChecklists,
      label: 'Aktivierungs-Checklisten',
      order: 250,
      table: 'activation_checklists',
      importArea: async (payload) => {
        const items = normalizeActivationChecklistItems(readArray(payload, STORAGE_KEYS.activationChecklists));
        for (const item of items) {
          const existing = await repositories.activationChecklistRepository.getById(item.id);
          if (existing) {
            await repositories.activationChecklistRepository.update(item);
          } else {
            await repositories.activationChecklistRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.activationApplications,
      label: 'Aktivierungsanträge',
      order: 260,
      table: 'activation_applications',
      importArea: async (payload) => {
        const items = normalizeActivationApplications(readArray(payload, STORAGE_KEYS.activationApplications));
        for (const item of items) {
          const existing = await repositories.activationApplicationRepository.getById(item.id);
          if (existing) {
            await repositories.activationApplicationRepository.update(item);
          } else {
            await repositories.activationApplicationRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.activationHardware,
      label: 'Aktivierungshardware',
      order: 270,
      table: 'activation_hardware',
      importArea: async (payload) => {
        const items = normalizeActivationHardwareList(readArray(payload, STORAGE_KEYS.activationHardware));
        for (const item of items) {
          const existing = await repositories.activationHardwareRepository.getById(item.id);
          if (existing) {
            await repositories.activationHardwareRepository.update(item);
          } else {
            await repositories.activationHardwareRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.activationBlockers,
      label: 'Aktivierungsblocker',
      order: 280,
      table: 'activation_blockers',
      importArea: async (payload) => {
        const items = normalizeActivationBlockers(readArray(payload, STORAGE_KEYS.activationBlockers));
        for (const item of items) {
          const existing = await repositories.activationBlockerRepository.getById(item.id);
          if (existing) {
            await repositories.activationBlockerRepository.update(item);
          } else {
            await repositories.activationBlockerRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.salesTasks,
      label: 'Aufgaben',
      order: 290,
      table: 'sales_tasks',
      conflictBySourceKey: true,
      importArea: async (payload) => {
        const items = normalizeSalesTasks(readArray(payload, STORAGE_KEYS.salesTasks));
        for (const item of items) {
          const existing = await repositories.salesTaskRepository.getById(item.id);
          if (existing) {
            await repositories.salesTaskRepository.update(item);
          } else {
            await repositories.salesTaskRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.salesActivities,
      label: 'Aktivitäten',
      order: 300,
      table: 'sales_activities',
      importArea: async (payload) => {
        const items = normalizeSalesActivities(readArray(payload, STORAGE_KEYS.salesActivities));
        for (const item of items) {
          const existing = await repositories.salesActivityRepository.getById(item.id);
          if (existing) {
            await repositories.salesActivityRepository.update(item);
          } else {
            await repositories.salesActivityRepository.create(item);
          }
        }
        return items.length;
      },
    },
    {
      key: STORAGE_KEYS.auditEntries,
      label: 'Audit',
      order: 310,
      table: 'audit_entries',
      importArea: async (payload) => {
        const items = normalizeAuditEntries(readArray(payload, STORAGE_KEYS.auditEntries));
        if (items.length === 0) {
          return 0;
        }
        await repositories.auditRepository.saveAll(items);
        return items.length;
      },
    },
  ];
}

async function countConflicts(table: string, ids: string[]): Promise<number> {
  if (!table || ids.length === 0) {
    return 0;
  }
  const rows = await sbSelectAll(table);
  const existingIds = new Set(rows.map((row) => String(row.id)));
  return ids.filter((id) => existingIds.has(id)).length;
}

function extractIdsForArea(area: MigrationAreaConfig, payload: Record<string, unknown>): string[] {
  if (area.key === 'offer_workflow_events') {
    return WORKFLOW_EVENT_KEYS.flatMap((key) =>
      normalizeOfferWorkflowEvents(readArray(payload, key)).map((event) => event.id),
    );
  }
  if (area.key === 'billing_metadata') {
    return [
      ...readTypedArray<{ id: string }>(payload, STORAGE_KEYS.billingImportSessions),
      ...readTypedArray<{ id: string }>(payload, STORAGE_KEYS.billingExtractedFields),
      ...readTypedArray<{ id: string }>(payload, STORAGE_KEYS.billingPeriodRecords),
      ...readTypedArray<{ id: string }>(payload, STORAGE_KEYS.customerCostBaselines),
      ...readTypedArray<{ id: string }>(payload, STORAGE_KEYS.billingCostLineItems),
    ].map((item) => item.id);
  }
  if (area.key === 'pricing_catalog') {
    return [
      ...normalizePriceBooks(readArray(payload, STORAGE_KEYS.priceBooks)),
      ...normalizePriceBookVersions(readArray(payload, STORAGE_KEYS.priceBookVersions)),
      ...normalizeContractTerms(readArray(payload, STORAGE_KEYS.contractTerms)),
      ...normalizePriceRules(readArray(payload, STORAGE_KEYS.priceRules)),
    ].map((item) => item.id);
  }
  const raw = readArray(payload, area.key);
  return raw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    .map((entry) => (typeof entry.id === 'string' ? entry.id : ''))
    .filter(Boolean);
}

async function recordMigrationRun(
  runId: string,
  userId: string,
  status: 'preview' | 'completed' | 'failed',
  data: Record<string, unknown>,
): Promise<void> {
  const client = getSupabaseClient();
  const timestamp = nowIso();
  const { error } = await client.from('data_migration_runs').upsert(
    {
      id: runId,
      user_id: userId,
      status,
      data,
      created_at: timestamp,
      updated_at: timestamp,
    },
    { onConflict: 'id' },
  );
  if (error) {
    throw new Error(`Migration-Run speichern fehlgeschlagen: ${error.message}`);
  }
}

export class SupabaseDataMigrationService {
  private readonly auditService: AuditService;

  constructor(auditService: AuditService) {
    this.auditService = auditService;
  }

  private ensureSupabaseMode(): void {
    if (!isSupabaseDataMode()) {
      throw new Error('Cloud-Migration ist nur im Supabase-Datenmodus verfügbar.');
    }
  }

  private getRepositories() {
    return {
      ...createCoreRepositories(),
      ...createOperationalRepositories(),
    };
  }

  async previewFromContent(
    context: UserContext,
    content: string,
  ): Promise<{ ok: true; preview: MigrationPreview } | { ok: false; error: 'forbidden' | 'invalid_mode' | 'invalid_payload' }> {
    this.ensureSupabaseMode();
    const guard = requirePermission(context, 'admin.backup');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }
    const payload = parseBackupContent(content);
    if (!payload) {
      return { ok: false, error: 'invalid_payload' };
    }
    const preview = await this.buildPreview({ source: 'backup', payload }, context);
    return { ok: true, preview };
  }

  async previewFromLocalStorage(
    context: UserContext,
  ): Promise<{ ok: true; preview: MigrationPreview } | { ok: false; error: 'forbidden' | 'invalid_mode' }> {
    this.ensureSupabaseMode();
    if (import.meta.env.PROD) {
      return { ok: false, error: 'invalid_mode' };
    }
    const guard = requirePermission(context, 'admin.backup');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }
    const preview = await this.buildPreview({ source: 'localStorage', payload: readLocalStoragePayload() }, context);
    return { ok: true, preview };
  }

  private async buildPreview(migrationPayload: MigrationPayload, context: UserContext): Promise<MigrationPreview> {
    const runId = generateId('migration_run');
    const repositories = this.getRepositories();
    const areas = buildMigrationAreas(repositories).sort((a, b) => a.order - b.order);
    const warnings: string[] = [];
    const conflicts: string[] = [];
    const recordCounts: Record<string, number> = {};
    const areaPreviews: MigrationAreaPreview[] = [];

    if (readArray(migrationPayload.payload, STORAGE_KEYS.billingSourceDocuments).length > 0) {
      warnings.push('Abrechnungs-Binärdateien werden nicht importiert.');
    }

    for (const area of areas) {
      const ids = extractIdsForArea(area, migrationPayload.payload);
      const recordCount = ids.length;
      recordCounts[area.key] = recordCount;
      const conflictCount = area.table ? await countConflicts(area.table, ids) : 0;
      if (conflictCount > 0) {
        conflicts.push(`${area.label}: ${conflictCount} bestehende Datensätze werden überschrieben.`);
      }
      areaPreviews.push({
        areaKey: area.key,
        label: area.label,
        recordCount,
        conflictCount,
        skipped: recordCount === 0,
      });
    }

    const preview: MigrationPreview = {
      valid: true,
      source: migrationPayload.source,
      areas: areaPreviews,
      conflicts,
      warnings,
      recordCounts,
      runId,
    };

    await recordMigrationRun(runId, context.userId, 'preview', preview as unknown as Record<string, unknown>);
    await this.auditService.logChange({
      context,
      action: 'migration',
      entityType: 'system',
      entityId: runId,
      summary: `Cloud-Migration Vorschau (${migrationPayload.source}, ${areaPreviews.reduce((sum, area) => sum + area.recordCount, 0)} Datensätze)`,
    });

    return preview;
  }

  async executeImport(
    context: UserContext,
    content: string,
    runId?: string,
  ): Promise<MigrationImportResult> {
    this.ensureSupabaseMode();
    const guard = requirePermission(context, 'admin.backup');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const payload = parseBackupContent(content);
    if (!payload) {
      return { ok: false, error: 'invalid_payload', message: 'Ungültiges Backup-Format.' };
    }

    const effectiveRunId = runId ?? generateId('migration_run');
    const repositories = this.getRepositories();
    const areas = buildMigrationAreas(repositories).sort((a, b) => a.order - b.order);
    const importedCounts: Record<string, number> = {};

    try {
      for (const area of areas) {
        importedCounts[area.key] = await area.importArea(payload);
      }

      await recordMigrationRun(effectiveRunId, context.userId, 'completed', {
        importedCounts,
        completedAt: nowIso(),
      });
      await this.auditService.logChange({
        context,
        action: 'migration',
        entityType: 'system',
        entityId: effectiveRunId,
        summary: `Cloud-Migration abgeschlossen (${Object.values(importedCounts).reduce((sum, count) => sum + count, 0)} Datensätze)`,
      });

      return { ok: true, runId: effectiveRunId, importedCounts };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
      await recordMigrationRun(effectiveRunId, context.userId, 'failed', {
        message,
        failedAt: nowIso(),
      });
      return { ok: false, error: 'failed', message, runId: effectiveRunId };
    }
  }
}
