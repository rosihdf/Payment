import type { SalesRepresentativeCommissionAssignment } from '../../domain/commission/commissionAssignment';
import type { CommissionPlan, CommissionPlanVersion } from '../../domain/commission/commissionPlan';
import type { CommissionRule } from '../../domain/commission/commissionRule';
import { migrateCommissionCatalogIfNeeded } from '../../services/commissionCatalogMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../../utils/storage';

export interface CommissionCatalogData {
  commissionPlans: CommissionPlan[];
  commissionPlanVersions: CommissionPlanVersion[];
  commissionRules: CommissionRule[];
  assignments: SalesRepresentativeCommissionAssignment[];
}

export interface CommissionCatalogRepository {
  getCatalog(): Promise<CommissionCatalogData>;
  saveCatalog(catalog: CommissionCatalogData): Promise<void>;
  saveRules(rules: CommissionRule[]): Promise<void>;
  saveAssignments(assignments: SalesRepresentativeCommissionAssignment[]): Promise<void>;
}

export class LocalCommissionCatalogRepository implements CommissionCatalogRepository {
  async getCatalog(): Promise<CommissionCatalogData> {
    migrateCommissionCatalogIfNeeded();

    return {
      commissionPlans: (readStorageItem<CommissionPlan[]>(STORAGE_KEYS.commissionPlans) ?? []).map(
        (item) => ({ ...item }),
      ),
      commissionPlanVersions: (
        readStorageItem<CommissionPlanVersion[]>(STORAGE_KEYS.commissionPlanVersions) ?? []
      ).map((item) => ({ ...item })),
      commissionRules: (readStorageItem<CommissionRule[]>(STORAGE_KEYS.commissionRules) ?? []).map(
        (item) => ({ ...item }),
      ),
      assignments: (
        readStorageItem<SalesRepresentativeCommissionAssignment[]>(STORAGE_KEYS.commissionAssignments) ??
        []
      ).map((item) => ({ ...item })),
    };
  }

  async saveCatalog(catalog: CommissionCatalogData): Promise<void> {
    writeStorageItem(STORAGE_KEYS.commissionPlans, catalog.commissionPlans);
    writeStorageItem(STORAGE_KEYS.commissionPlanVersions, catalog.commissionPlanVersions);
    writeStorageItem(STORAGE_KEYS.commissionRules, catalog.commissionRules);
    writeStorageItem(STORAGE_KEYS.commissionAssignments, catalog.assignments);
  }

  async saveRules(rules: CommissionRule[]): Promise<void> {
    writeStorageItem(STORAGE_KEYS.commissionRules, rules);
  }

  async saveAssignments(assignments: SalesRepresentativeCommissionAssignment[]): Promise<void> {
    writeStorageItem(STORAGE_KEYS.commissionAssignments, assignments);
  }
}
