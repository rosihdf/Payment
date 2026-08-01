import type {
  CommissionCatalogData,
  CommissionCatalogRepository,
} from '../local/LocalCommissionCatalogRepository';
import { rowData, sbSelectAll, sbUpsertMany, type JsonTableRow } from './supabaseTable';

function planToRow(item: CommissionCatalogData['commissionPlans'][number]): Record<string, unknown> {
  return {
    id: item.id,
    data: item,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function planVersionToRow(
  item: CommissionCatalogData['commissionPlanVersions'][number],
): Record<string, unknown> {
  return {
    id: item.id,
    plan_id: item.commissionPlanId,
    data: item,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function ruleToRow(item: CommissionCatalogData['commissionRules'][number]): Record<string, unknown> {
  return {
    id: item.id,
    data: item,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function assignmentToRow(
  item: CommissionCatalogData['assignments'][number],
): Record<string, unknown> {
  return {
    id: item.id,
    sales_representative_id: item.salesRepresentativeId,
    data: item,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export class SupabaseCommissionCatalogRepository implements CommissionCatalogRepository {
  async getCatalog(): Promise<CommissionCatalogData> {
    const [planRows, versionRows, ruleRows, assignmentRows] = await Promise.all([
      sbSelectAll('commission_plans'),
      sbSelectAll('commission_plan_versions'),
      sbSelectAll('commission_rules'),
      sbSelectAll('commission_assignments'),
    ]);

    return {
      commissionPlans: planRows.map((row) =>
        rowData<CommissionCatalogData['commissionPlans'][number]>(row, {
          id: String(row.id),
        } as CommissionCatalogData['commissionPlans'][number]),
      ),
      commissionPlanVersions: versionRows.map((row: JsonTableRow) =>
        rowData<CommissionCatalogData['commissionPlanVersions'][number]>(row, {
          id: String(row.id),
          commissionPlanId: String(row.plan_id ?? ''),
        } as CommissionCatalogData['commissionPlanVersions'][number]),
      ),
      commissionRules: ruleRows.map((row) =>
        rowData<CommissionCatalogData['commissionRules'][number]>(row, {
          id: String(row.id),
        } as CommissionCatalogData['commissionRules'][number]),
      ),
      assignments: assignmentRows.map((row: JsonTableRow) =>
        rowData<CommissionCatalogData['assignments'][number]>(row, {
          id: String(row.id),
          salesRepresentativeId: String(row.sales_representative_id ?? ''),
        } as CommissionCatalogData['assignments'][number]),
      ),
    };
  }

  async saveCatalog(catalog: CommissionCatalogData): Promise<void> {
    await Promise.all([
      sbUpsertMany('commission_plans', catalog.commissionPlans.map(planToRow)),
      sbUpsertMany('commission_plan_versions', catalog.commissionPlanVersions.map(planVersionToRow)),
      sbUpsertMany('commission_rules', catalog.commissionRules.map(ruleToRow)),
      sbUpsertMany('commission_assignments', catalog.assignments.map(assignmentToRow)),
    ]);
  }
}
