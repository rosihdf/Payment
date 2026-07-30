import type { BestPayComparisonSession } from '../domain/bestPayComparison/bestPayComparisonSession';
import { BESTPAY_COMPARISON_SCHEMA_VERSION } from '../domain/bestPayComparison/bestPayComparisonSession';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_BESTPAY_COMPARISON_STORAGE_VERSION = 1;

export function migrateBestPayComparisonStorageIfNeeded(): void {
  const version = readStorageItem<number>(STORAGE_KEYS.bestPayComparisonStorageVersion);
  if (version === CURRENT_BESTPAY_COMPARISON_STORAGE_VERSION) {
    const sessions = readStorageItem<BestPayComparisonSession[]>(
      STORAGE_KEYS.bestPayComparisonSessions,
    );
    if (!sessions) {
      writeStorageItem(STORAGE_KEYS.bestPayComparisonSessions, []);
    }
    return;
  }

  const sessions = readStorageItem<BestPayComparisonSession[]>(
    STORAGE_KEYS.bestPayComparisonSessions,
  );
  writeStorageItem(
    STORAGE_KEYS.bestPayComparisonSessions,
    (sessions ?? []).filter(
      (session) => session.schemaVersion === BESTPAY_COMPARISON_SCHEMA_VERSION,
    ),
  );
  writeStorageItem(
    STORAGE_KEYS.bestPayComparisonStorageVersion,
    CURRENT_BESTPAY_COMPARISON_STORAGE_VERSION,
  );
}

export function readBestPayComparisonSessions(): BestPayComparisonSession[] {
  migrateBestPayComparisonStorageIfNeeded();
  return readStorageItem<BestPayComparisonSession[]>(STORAGE_KEYS.bestPayComparisonSessions) ?? [];
}

export function writeBestPayComparisonSessions(sessions: BestPayComparisonSession[]): void {
  migrateBestPayComparisonStorageIfNeeded();
  writeStorageItem(STORAGE_KEYS.bestPayComparisonSessions, sessions);
}

export function saveBestPayComparisonSession(session: BestPayComparisonSession): void {
  const sessions = readBestPayComparisonSessions();
  const index = sessions.findIndex((entry) => entry.id === session.id);
  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.push(session);
  }
  writeBestPayComparisonSessions(sessions);
}
