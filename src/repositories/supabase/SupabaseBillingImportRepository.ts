import type { BillingCostLineItem } from '../../domain/billingImport/billingCostLineItem';
import type { BillingImportSession } from '../../domain/billingImport/billingImportSession';
import type { BillingSourceDocument } from '../../domain/billingImport/billingSourceDocument';
import type { ExtractedBillingField } from '../../domain/billingImport/extractedBillingField';
import type { BillingPeriodRecord } from '../../domain/billingImport/billingPeriodRecord';
import type { CustomerCostBaseline } from '../../domain/billingImport/customerCostBaseline';
import type {
  BillingImportRepository,
  BillingImportStoreData,
} from '../interfaces/BillingImportRepository';
import { rowData, sbSelectAll, sbUpsertMany } from './supabaseTable';

function sessionToRow(session: BillingImportSession): Record<string, unknown> {
  return {
    id: session.id,
    lead_id: session.leadId,
    offer_id: session.offerId,
    created_by_user_id: session.createdByUserId,
    data: session,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

function documentToRow(document: BillingSourceDocument): Record<string, unknown> {
  return {
    id: document.id,
    session_id: document.sessionId,
    data: document,
    created_at: document.createdAt,
  };
}

function fieldToRow(field: ExtractedBillingField, sessionId: string): Record<string, unknown> {
  return {
    id: field.id,
    session_id: sessionId,
    data: field,
    created_at: field.correctedAt ?? new Date().toISOString(),
  };
}

function periodToRow(period: BillingPeriodRecord): Record<string, unknown> {
  return {
    id: period.id,
    session_id: period.sessionId,
    data: period,
    created_at: new Date().toISOString(),
  };
}

function baselineToRow(baseline: CustomerCostBaseline): Record<string, unknown> {
  return {
    id: baseline.id,
    lead_id: baseline.leadId,
    session_id: baseline.billingImportSessionId,
    data: baseline,
    created_at: baseline.createdAt,
    updated_at: baseline.updatedAt,
  };
}

function costLineItemToRow(item: BillingCostLineItem): Record<string, unknown> {
  return {
    id: item.id,
    session_id: item.sessionId,
    data: item,
    created_at: item.createdAt,
  };
}

function resolveFieldSessionId(
  field: ExtractedBillingField,
  documents: BillingSourceDocument[],
): string {
  const document = documents.find((entry) => entry.id === field.documentId);
  return document?.sessionId ?? '';
}

export class SupabaseBillingImportRepository implements BillingImportRepository {
  async readStore(): Promise<BillingImportStoreData> {
    const [sessionRows, documentRows, fieldRows, periodRows, baselineRows, costLineRows] =
      await Promise.all([
        sbSelectAll('billing_import_sessions'),
        sbSelectAll('billing_source_documents'),
        sbSelectAll('billing_extracted_fields'),
        sbSelectAll('billing_period_records'),
        sbSelectAll('customer_cost_baselines'),
        sbSelectAll('billing_cost_line_items'),
      ]);

    const documents = documentRows.map((row) =>
      rowData<BillingSourceDocument>(row, {
        id: String(row.id),
        sessionId: String(row.session_id ?? ''),
      } as BillingSourceDocument),
    );

    return {
      sessions: sessionRows.map((row) =>
        rowData<BillingImportSession>(row, {
          id: String(row.id),
          leadId: (row.lead_id as string | null) ?? null,
          offerId: (row.offer_id as string | null) ?? null,
          createdByUserId: String(row.created_by_user_id ?? ''),
          createdAt: String(row.created_at ?? ''),
          updatedAt: String(row.updated_at ?? ''),
        } as BillingImportSession),
      ),
      documents,
      fields: fieldRows.map((row) =>
        rowData<ExtractedBillingField>(row, { id: String(row.id) } as ExtractedBillingField),
      ),
      periods: periodRows.map((row) =>
        rowData<BillingPeriodRecord>(row, {
          id: String(row.id),
          sessionId: String(row.session_id ?? ''),
        } as BillingPeriodRecord),
      ),
      baselines: baselineRows.map((row) =>
        rowData<CustomerCostBaseline>(row, {
          id: String(row.id),
          leadId: (row.lead_id as string | null) ?? null,
          billingImportSessionId: String(row.session_id ?? ''),
        } as CustomerCostBaseline),
      ),
      costLineItems: costLineRows.map((row) =>
        rowData<BillingCostLineItem>(row, {
          id: String(row.id),
          sessionId: String(row.session_id ?? ''),
        } as BillingCostLineItem),
      ),
    };
  }

  async writeStore(store: BillingImportStoreData): Promise<void> {
    await Promise.all([
      sbUpsertMany('billing_import_sessions', store.sessions.map(sessionToRow)),
      sbUpsertMany('billing_source_documents', store.documents.map(documentToRow)),
      sbUpsertMany(
        'billing_extracted_fields',
        store.fields.map((field) => fieldToRow(field, resolveFieldSessionId(field, store.documents))),
      ),
      sbUpsertMany('billing_period_records', store.periods.map(periodToRow)),
      sbUpsertMany('customer_cost_baselines', store.baselines.map(baselineToRow)),
      sbUpsertMany('billing_cost_line_items', store.costLineItems.map(costLineItemToRow)),
    ]);
  }
}
