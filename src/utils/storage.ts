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
} as const;

export function readStorageItem<T>(key: string): T | null {
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
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorageItem(key: string): void {
  localStorage.removeItem(key);
}
