import type { SalesActivity } from '../domain/salesWorkspace/salesActivity';
import { SALES_ACTIVITY_SCHEMA_VERSION } from '../domain/salesWorkspace/salesActivity';
import type { SalesTask } from '../domain/salesWorkspace/salesTask';
import { SALES_TASK_SCHEMA_VERSION } from '../domain/salesWorkspace/salesTask';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_SALES_TASK_STORAGE_VERSION = 1;
export const CURRENT_SALES_ACTIVITY_STORAGE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function normalizeSalesTask(raw: unknown): SalesTask | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.createdByUserId !== 'string') {
    return null;
  }
  if (typeof raw.title !== 'string' || typeof raw.assigneeUserId !== 'string') {
    return null;
  }

  return {
    id: raw.id,
    schemaVersion: SALES_TASK_SCHEMA_VERSION,
    title: raw.title,
    description: typeof raw.description === 'string' ? raw.description : '',
    type: (typeof raw.type === 'string' ? raw.type : 'general') as SalesTask['type'],
    status: (typeof raw.status === 'string' ? raw.status : 'open') as SalesTask['status'],
    priority: (typeof raw.priority === 'string' ? raw.priority : 'normal') as SalesTask['priority'],
    dueAt: asStringOrNull(raw.dueAt),
    dueTimeLocal: asStringOrNull(raw.dueTimeLocal),
    assigneeUserId: raw.assigneeUserId,
    createdByUserId: raw.createdByUserId,
    completedAt: asStringOrNull(raw.completedAt),
    completedByUserId: asStringOrNull(raw.completedByUserId),
    completionNote: typeof raw.completionNote === 'string' ? raw.completionNote : '',
    leadId: asStringOrNull(raw.leadId),
    comparisonSessionId: asStringOrNull(raw.comparisonSessionId),
    offerId: asStringOrNull(raw.offerId),
    contractId: asStringOrNull(raw.contractId),
    contractVersionId: asStringOrNull(raw.contractVersionId),
    activationId: asStringOrNull(raw.activationId),
    wizardEnabled: Boolean(raw.wizardEnabled),
    origin: (typeof raw.origin === 'string' ? raw.origin : 'manual') as SalesTask['origin'],
    sourceKey: asStringOrNull(raw.sourceKey),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
  };
}

export function normalizeSalesActivity(raw: unknown): SalesActivity | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.createdByUserId !== 'string') {
    return null;
  }
  if (typeof raw.title !== 'string' || typeof raw.type !== 'string') {
    return null;
  }

  const isSystem = Boolean(raw.isSystem);
  return {
    id: raw.id,
    schemaVersion: SALES_ACTIVITY_SCHEMA_VERSION,
    type: raw.type as SalesActivity['type'],
    title: raw.title,
    description: typeof raw.description === 'string' ? raw.description : '',
    occurredAt: typeof raw.occurredAt === 'string' ? raw.occurredAt : new Date(0).toISOString(),
    createdByUserId: raw.createdByUserId,
    leadId: asStringOrNull(raw.leadId),
    comparisonSessionId: asStringOrNull(raw.comparisonSessionId),
    offerId: asStringOrNull(raw.offerId),
    contractId: asStringOrNull(raw.contractId),
    contractVersionId: asStringOrNull(raw.contractVersionId),
    activationId: asStringOrNull(raw.activationId),
    taskId: asStringOrNull(raw.taskId),
    isSystem,
    editable: typeof raw.editable === 'boolean' ? raw.editable : !isSystem,
    sourceKey: asStringOrNull(raw.sourceKey),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
  };
}

export function migrateSalesTaskStorageIfNeeded(): void {
  const version = readStorageItem<number>(STORAGE_KEYS.salesTaskStorageVersion);
  if (version === CURRENT_SALES_TASK_STORAGE_VERSION) {
    const items = readStorageItem<unknown[]>(STORAGE_KEYS.salesTasks);
    if (!Array.isArray(items)) {
      writeStorageItem(STORAGE_KEYS.salesTasks, []);
    } else {
      writeStorageItem(
        STORAGE_KEYS.salesTasks,
        items.map(normalizeSalesTask).filter((entry): entry is SalesTask => entry !== null),
      );
    }
    return;
  }

  const legacy = readStorageItem<unknown[]>(STORAGE_KEYS.salesTasks);
  const tasks = Array.isArray(legacy)
    ? legacy.map(normalizeSalesTask).filter((entry): entry is SalesTask => entry !== null)
    : [];
  writeStorageItem(STORAGE_KEYS.salesTasks, tasks);
  writeStorageItem(STORAGE_KEYS.salesTaskStorageVersion, CURRENT_SALES_TASK_STORAGE_VERSION);
}

export function migrateSalesActivityStorageIfNeeded(): void {
  const version = readStorageItem<number>(STORAGE_KEYS.salesActivityStorageVersion);
  if (version === CURRENT_SALES_ACTIVITY_STORAGE_VERSION) {
    const items = readStorageItem<unknown[]>(STORAGE_KEYS.salesActivities);
    if (!Array.isArray(items)) {
      writeStorageItem(STORAGE_KEYS.salesActivities, []);
    } else {
      writeStorageItem(
        STORAGE_KEYS.salesActivities,
        items.map(normalizeSalesActivity).filter((entry): entry is SalesActivity => entry !== null),
      );
    }
    return;
  }

  const legacy = readStorageItem<unknown[]>(STORAGE_KEYS.salesActivities);
  const activities = Array.isArray(legacy)
    ? legacy.map(normalizeSalesActivity).filter((entry): entry is SalesActivity => entry !== null)
    : [];
  writeStorageItem(STORAGE_KEYS.salesActivities, activities);
  writeStorageItem(
    STORAGE_KEYS.salesActivityStorageVersion,
    CURRENT_SALES_ACTIVITY_STORAGE_VERSION,
  );
}
