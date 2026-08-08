import type { BestPayComparisonSession } from '../domain/bestPayComparison/bestPayComparisonSession';
import {
  BESTPAY_COMPARISON_SCHEMA_VERSION,
  DEFAULT_BESTPAY_MANUAL_INPUT,
  DEFAULT_SALES_WIZARD_STATE,
} from '../domain/bestPayComparison/bestPayComparisonSession';
import { resolveBestPayComparisonTitle } from '../domain/bestPayComparison/bestPayComparisonSummary';
import type { CostCaptureMode } from '../domain/bestPayComparison/costCaptureMode';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_BESTPAY_COMPARISON_STORAGE_VERSION = 3;

export interface BestPayComparisonStore {
  activeSessionId: string | null;
  sessions: BestPayComparisonSession[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asCostCaptureMode(value: unknown): CostCaptureMode | null {
  if (value === 'manual' || value === 'billing_import' || value === 'no_current_costs') {
    return value;
  }
  return null;
}

export function normalizeBestPayComparisonSession(raw: unknown): BestPayComparisonSession | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.createdByUserId !== 'string') {
    return null;
  }

  const schemaVersion =
    typeof raw.schemaVersion === 'number' ? raw.schemaVersion : BESTPAY_COMPARISON_SCHEMA_VERSION;
  if (schemaVersion > BESTPAY_COMPARISON_SCHEMA_VERSION) {
    // Unbekannte zukünftige Version: so viel wie möglich behalten, ohne Crash.
  }

  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString();
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt;
  const manualInput = isRecord(raw.manualInput)
    ? {
        ...DEFAULT_BESTPAY_MANUAL_INPUT,
        ...raw.manualInput,
        paymentUsage: {
          ...DEFAULT_BESTPAY_MANUAL_INPUT.paymentUsage,
          ...(isRecord(raw.manualInput.paymentUsage) ? raw.manualInput.paymentUsage : {}),
        },
      }
    : { ...DEFAULT_BESTPAY_MANUAL_INPUT };

  const wizardRaw = isRecord(raw.wizard) ? raw.wizard : null;
  const prospectRaw = wizardRaw && isRecord(wizardRaw.prospectDraft) ? wizardRaw.prospectDraft : null;

  const session: BestPayComparisonSession = {
    id: raw.id,
    schemaVersion: BESTPAY_COMPARISON_SCHEMA_VERSION,
    status: (typeof raw.status === 'string' ? raw.status : 'draft') as BestPayComparisonSession['status'],
    source: (raw.source as BestPayComparisonSession['source']) ?? null,
    entryMode: raw.entryMode === 'wizard' ? 'wizard' : 'calculator',
    title: asStringOrNull(raw.title),
    leadId: asStringOrNull(raw.leadId),
    customerLabel: asStringOrNull(raw.customerLabel),
    leadDisplayName: asStringOrNull(raw.leadDisplayName) ?? asStringOrNull(raw.customerLabel),
    billingImportSessionId: asStringOrNull(raw.billingImportSessionId),
    costBaselineId: asStringOrNull(raw.costBaselineId),
    costBaselineVersion: asNumberOrNull(raw.costBaselineVersion),
    manualInput,
    result: (raw.result as BestPayComparisonSession['result']) ?? null,
    selectedCandidateId: asStringOrNull(raw.selectedCandidateId),
    offerId: asStringOrNull(raw.offerId),
    offerNumber: asStringOrNull(raw.offerNumber),
    offerTitle: asStringOrNull(raw.offerTitle),
    offerCreationToken: asStringOrNull(raw.offerCreationToken),
    duplicateOfSessionId: asStringOrNull(raw.duplicateOfSessionId),
    wizard: {
      enabled: Boolean(wizardRaw?.enabled),
      currentStep:
        typeof wizardRaw?.currentStep === 'string'
          ? (wizardRaw.currentStep as BestPayComparisonSession['wizard']['currentStep'])
          : DEFAULT_SALES_WIZARD_STATE.currentStep,
      costCaptureMode: asCostCaptureMode(wizardRaw?.costCaptureMode),
      prospectDraft: {
        companyName: typeof prospectRaw?.companyName === 'string' ? prospectRaw.companyName : '',
        contactFirstName:
          typeof prospectRaw?.contactFirstName === 'string' ? prospectRaw.contactFirstName : '',
        contactLastName:
          typeof prospectRaw?.contactLastName === 'string' ? prospectRaw.contactLastName : '',
        phone: typeof prospectRaw?.phone === 'string' ? prospectRaw.phone : '',
        email: typeof prospectRaw?.email === 'string' ? prospectRaw.email : '',
        industry: typeof prospectRaw?.industry === 'string' ? prospectRaw.industry : '',
        notes: typeof prospectRaw?.notes === 'string' ? prospectRaw.notes : '',
        currentProviderCode:
          typeof prospectRaw?.currentProviderCode === 'string'
            ? prospectRaw.currentProviderCode
            : '',
        currentProviderOther:
          typeof prospectRaw?.currentProviderOther === 'string'
            ? prospectRaw.currentProviderOther
            : '',
      },
      scenarios: Array.isArray(wizardRaw?.scenarios)
        ? (wizardRaw.scenarios as BestPayComparisonSession['wizard']['scenarios'])
        : [],
      selectedScenarioId: asStringOrNull(wizardRaw?.selectedScenarioId),
      maxReachedStep:
        typeof wizardRaw?.maxReachedStep === 'string'
          ? (wizardRaw.maxReachedStep as BestPayComparisonSession['wizard']['maxReachedStep'])
          : typeof wizardRaw?.currentStep === 'string'
            ? (wizardRaw.currentStep as BestPayComparisonSession['wizard']['currentStep'])
            : DEFAULT_SALES_WIZARD_STATE.maxReachedStep,
      approvalAcknowledgedAt: asStringOrNull(wizardRaw?.approvalAcknowledgedAt),
      approvalNotes: typeof wizardRaw?.approvalNotes === 'string' ? wizardRaw.approvalNotes : '',
      followUpNotes: typeof wizardRaw?.followUpNotes === 'string' ? wizardRaw.followUpNotes : '',
      wizardCompletedAt: asStringOrNull(wizardRaw?.wizardCompletedAt),
    },
    createdByUserId: raw.createdByUserId,
    createdAt,
    updatedAt,
    lastOpenedAt: asStringOrNull(raw.lastOpenedAt),
    completedAt: asStringOrNull(raw.completedAt),
    archivedAt: asStringOrNull(raw.archivedAt),
    discardedAt: asStringOrNull(raw.discardedAt),
  };

  if (!session.title) {
    session.title = resolveBestPayComparisonTitle(session);
  }

  return session;
}

function readLegacySessionArray(): unknown[] {
  const raw = readStorageItem<unknown>(STORAGE_KEYS.bestPayComparisonSessions);
  if (Array.isArray(raw)) {
    return raw;
  }
  if (isRecord(raw) && Array.isArray(raw.sessions)) {
    return raw.sessions;
  }
  return [];
}

function migrateSessions(rawSessions: unknown[]): BestPayComparisonSession[] {
  const migrated: BestPayComparisonSession[] = [];
  for (const entry of rawSessions) {
    const session = normalizeBestPayComparisonSession(entry);
    if (session) {
      migrated.push(session);
    }
  }
  return migrated;
}

export function migrateBestPayComparisonStorageIfNeeded(): void {
  const version = readStorageItem<number>(STORAGE_KEYS.bestPayComparisonStorageVersion);

  if (version === CURRENT_BESTPAY_COMPARISON_STORAGE_VERSION) {
    const store = readStorageItem<BestPayComparisonStore>(STORAGE_KEYS.bestPayComparisonSessions);
    if (!store || !Array.isArray(store.sessions)) {
      writeStorageItem(STORAGE_KEYS.bestPayComparisonSessions, {
        activeSessionId: null,
        sessions: [],
      } satisfies BestPayComparisonStore);
    } else {
      // Normalize sessions in place for additive schema fields.
      writeStorageItem(STORAGE_KEYS.bestPayComparisonSessions, {
        activeSessionId: store.activeSessionId ?? null,
        sessions: migrateSessions(store.sessions),
      } satisfies BestPayComparisonStore);
    }
    return;
  }

  // v1: Array; v2: Store ohne Wizard-Felder; unbekannt/null: aus Array/Store lesen
  const legacy = readLegacySessionArray();
  const sessions = migrateSessions(legacy);
  const existingStore = readStorageItem<BestPayComparisonStore>(STORAGE_KEYS.bestPayComparisonSessions);
  const activeSessionId =
    (isRecord(existingStore) ? asStringOrNull(existingStore.activeSessionId) : null) ??
    sessions
      .filter((session) => session.status !== 'discarded' && !session.archivedAt)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]?.id ??
    null;

  writeStorageItem(STORAGE_KEYS.bestPayComparisonSessions, {
    activeSessionId,
    sessions,
  } satisfies BestPayComparisonStore);
  writeStorageItem(
    STORAGE_KEYS.bestPayComparisonStorageVersion,
    CURRENT_BESTPAY_COMPARISON_STORAGE_VERSION,
  );
}

export function readBestPayComparisonStore(): BestPayComparisonStore {
  migrateBestPayComparisonStorageIfNeeded();
  const store = readStorageItem<BestPayComparisonStore>(STORAGE_KEYS.bestPayComparisonSessions);
  if (!store || !Array.isArray(store.sessions)) {
    return { activeSessionId: null, sessions: [] };
  }
  return {
    activeSessionId: store.activeSessionId ?? null,
    sessions: store.sessions
      .map((session) => normalizeBestPayComparisonSession(session))
      .filter((session): session is BestPayComparisonSession => session !== null),
  };
}

export function writeBestPayComparisonStore(store: BestPayComparisonStore): void {
  migrateBestPayComparisonStorageIfNeeded();
  writeStorageItem(STORAGE_KEYS.bestPayComparisonSessions, {
    activeSessionId: store.activeSessionId,
    sessions: store.sessions,
  } satisfies BestPayComparisonStore);
}

export function readBestPayComparisonSessions(): BestPayComparisonSession[] {
  return readBestPayComparisonStore().sessions;
}

export function writeBestPayComparisonSessions(sessions: BestPayComparisonSession[]): void {
  const store = readBestPayComparisonStore();
  writeBestPayComparisonStore({
    ...store,
    sessions,
  });
}

export function saveBestPayComparisonSession(session: BestPayComparisonSession): void {
  const store = readBestPayComparisonStore();
  const index = store.sessions.findIndex((entry) => entry.id === session.id);
  if (index >= 0) {
    store.sessions[index] = session;
  } else {
    store.sessions.push(session);
  }
  writeBestPayComparisonStore(store);
}

export function setActiveBestPayComparisonSessionId(sessionId: string | null): void {
  const store = readBestPayComparisonStore();
  store.activeSessionId = sessionId;
  writeBestPayComparisonStore(store);
}

export function getActiveBestPayComparisonSessionId(): string | null {
  return readBestPayComparisonStore().activeSessionId;
}

export function removeBestPayComparisonSession(sessionId: string): void {
  const store = readBestPayComparisonStore();
  store.sessions = store.sessions.filter((session) => session.id !== sessionId);
  if (store.activeSessionId === sessionId) {
    store.activeSessionId = null;
  }
  writeBestPayComparisonStore(store);
}
