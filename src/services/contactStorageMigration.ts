import type { Contact } from '../domain/contact/contact';
import { normalizeContacts } from '../domain/contact/normalizeContact';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

export const CURRENT_CONTACT_STORAGE_VERSION = 1;

export function migrateContactStorageIfNeeded(): void {
  const version = readStorageItem<number>(STORAGE_KEYS.contactStorageVersion);
  if (version === CURRENT_CONTACT_STORAGE_VERSION) {
    const items = readStorageItem<unknown[]>(STORAGE_KEYS.contacts);
    if (!Array.isArray(items)) {
      writeStorageItem(STORAGE_KEYS.contacts, []);
    } else {
      writeStorageItem(STORAGE_KEYS.contacts, normalizeContacts(items));
    }
    return;
  }

  const legacy = readStorageItem<unknown[]>(STORAGE_KEYS.contacts);
  const contacts: Contact[] = Array.isArray(legacy) ? normalizeContacts(legacy) : [];
  writeStorageItem(STORAGE_KEYS.contacts, contacts);
  writeStorageItem(STORAGE_KEYS.contactStorageVersion, CURRENT_CONTACT_STORAGE_VERSION);
}
