import { describe, expect, it } from 'vitest';
import {
  APP_UPDATE_PREFERENCE_KEYS,
  clearUpdateSnooze,
  createLocalStoragePreferenceStore,
  isUpdateVersionSnoozed,
  recordAutomaticCheck,
  shouldRunAutomaticCheck,
  snoozeUpdateVersion,
  type AppUpdatePreferenceStore,
} from '../domain/appUpdate/appUpdatePreferences';

function memoryStore(initial: Record<string, string> = {}): AppUpdatePreferenceStore {
  const data = { ...initial };
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe('appUpdatePreferences', () => {
  it('erlaubt Auto-Check wenn noch nie geprüft', () => {
    expect(shouldRunAutomaticCheck(memoryStore(), 1_000)).toBe(true);
  });

  it('sperrt Auto-Check innerhalb von 24 Stunden', () => {
    const store = memoryStore();
    const now = 1_000_000;
    recordAutomaticCheck(store, now);
    expect(shouldRunAutomaticCheck(store, now + 60_000)).toBe(false);
    expect(shouldRunAutomaticCheck(store, now + 24 * 60 * 60 * 1000)).toBe(true);
  });

  it('snoozed nur die angebotene Version', () => {
    const store = memoryStore();
    const now = 5_000;
    snoozeUpdateVersion(store, 10005, now, 24 * 60 * 60 * 1000);
    expect(isUpdateVersionSnoozed(store, 10005, now + 1000)).toBe(true);
    expect(isUpdateVersionSnoozed(store, 10006, now + 1000)).toBe(false);
    expect(isUpdateVersionSnoozed(store, 10005, now + 24 * 60 * 60 * 1000)).toBe(false);
  });

  it('löscht Snooze vollständig', () => {
    const store = memoryStore();
    snoozeUpdateVersion(store, 10005, 0, 1000);
    clearUpdateSnooze(store);
    expect(store.getItem(APP_UPDATE_PREFERENCE_KEYS.snoozedVersion)).toBeNull();
    expect(store.getItem(APP_UPDATE_PREFERENCE_KEYS.snoozedUntil)).toBeNull();
  });

  it('localStorage-Store liest und schreibt', () => {
    localStorage.clear();
    const store = createLocalStoragePreferenceStore();
    store.setItem(APP_UPDATE_PREFERENCE_KEYS.lastCheckAt, '123');
    expect(store.getItem(APP_UPDATE_PREFERENCE_KEYS.lastCheckAt)).toBe('123');
    store.removeItem(APP_UPDATE_PREFERENCE_KEYS.lastCheckAt);
    expect(store.getItem(APP_UPDATE_PREFERENCE_KEYS.lastCheckAt)).toBeNull();
  });
});
