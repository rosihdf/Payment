import { normalizeLeads } from '../domain/lead/normalizeLead';
import { BESTPAY_A920_TARIFFS_RAW } from '../domain/tariff/bestPayTariffs';
import { normalizeTariffs } from '../domain/tariff/normalizeTariff';
import { BESTPAY_PRODUCTS_RAW } from '../domain/product/bestPayProducts';
import { normalizeProducts } from '../domain/product/normalizeProduct';
import type { Lead } from '../domain/lead/lead';
import type { Product } from '../domain/product/product';
import type { Tariff } from '../domain/tariff/tariff';
import type { User } from '../domain/user/user';
import {
  CURRENT_OFFER_DOCUMENT_STORAGE_VERSION,
  migrateOfferDocumentStorageIfNeeded,
} from './offerDocumentStorageMigration';
import {
  CURRENT_OFFER_STORAGE_VERSION,
  migrateOfferStorageIfNeeded,
} from './offerStorageMigration';
import {
  CURRENT_PRODUCT_CATALOG_VERSION,
  migrateProductCatalogIfNeeded,
} from './productCatalogMigration';
import {
  CURRENT_TARIFF_CATALOG_VERSION,
  migrateTariffCatalogIfNeeded,
} from './tariffCatalogMigration';
import {
  migrateRecommendationCatalogIfNeeded,
  migrateRecommendationStorageIfNeeded,
} from './recommendationStorageMigration';
import { migrateBillingImportStorageIfNeeded } from './billingImportStorageMigration';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

const DEMO_USERS: User[] = [
  { id: 'user_001', name: 'Laura Berger', role: 'field_service' },
  { id: 'user_002', name: 'Thomas Klein', role: 'field_service' },
  { id: 'user_003', name: 'Sarah Hoffmann', role: 'field_service' },
  { id: 'user_004', name: 'Michael Weber', role: 'admin' },
];

const DEMO_LEADS = [
  {
    id: 'lead_001',
    company: 'Café Sonnenschein GmbH',
    contact: 'Anna Müller',
    phone: '+49 30 12345678',
    email: 'anna.mueller@cafe-sonnenschein.de',
    status: 'new',
    interest: 'high',
    createdAt: '2026-07-20T08:15:00.000Z',
    updatedAt: '2026-07-20T08:15:00.000Z',
  },
  {
    id: 'lead_002',
    company: 'Modehaus Richter',
    contact: 'Peter Richter',
    phone: '+49 40 87654321',
    email: 'p.richter@modehaus-richter.de',
    status: 'contacted',
    interest: 'medium',
    createdAt: '2026-07-18T10:30:00.000Z',
    updatedAt: '2026-07-22T14:00:00.000Z',
  },
  {
    id: 'lead_003',
    company: 'Autohaus Neumann',
    contact: 'Julia Neumann',
    phone: '+49 89 44556677',
    email: 'julia.neumann@autohaus-neumann.de',
    status: 'qualified',
    interest: 'high',
    createdAt: '2026-07-15T09:00:00.000Z',
    updatedAt: '2026-07-25T11:20:00.000Z',
  },
  {
    id: 'lead_004',
    company: 'Bäckerei Krause',
    contact: 'Helmut Krause',
    phone: '+49 221 99887766',
    email: 'info@baeckerei-krause.de',
    status: 'new',
    interest: 'low',
    createdAt: '2026-07-26T07:45:00.000Z',
    updatedAt: '2026-07-26T07:45:00.000Z',
  },
  {
    id: 'lead_005',
    company: 'FitStudio Aktiv',
    contact: 'Nina Scholz',
    phone: '+49 711 55443322',
    email: 'nina.scholz@fitstudio-aktiv.de',
    status: 'contacted',
    interest: 'medium',
    createdAt: '2026-07-12T13:10:00.000Z',
    updatedAt: '2026-07-24T16:30:00.000Z',
  },
  {
    id: 'lead_006',
    company: 'Hotel Am Park',
    contact: 'Robert Stein',
    phone: '+49 351 11223344',
    email: 'r.stein@hotel-am-park.de',
    status: 'won',
    interest: 'high',
    createdAt: '2026-06-28T08:00:00.000Z',
    updatedAt: '2026-07-10T09:15:00.000Z',
  },
  {
    id: 'lead_007',
    company: 'Elektro Wagner',
    contact: 'Markus Wagner',
    phone: '+49 511 66778899',
    email: 'markus.wagner@elektro-wagner.de',
    status: 'lost',
    interest: 'low',
    createdAt: '2026-06-20T11:00:00.000Z',
    updatedAt: '2026-07-05T15:40:00.000Z',
  },
  {
    id: 'lead_008',
    company: 'Blumenladen Flora',
    contact: 'Eva Brandt',
    phone: '+49 69 33445566',
    email: 'eva.brandt@blumen-flora.de',
    status: 'new',
    interest: 'medium',
    createdAt: '2026-07-28T12:20:00.000Z',
    updatedAt: '2026-07-28T12:20:00.000Z',
  },
];

export function getDemoUsers(): User[] {
  return DEMO_USERS.map((user) => ({ ...user }));
}

export function getDemoLeads(): Lead[] {
  return normalizeLeads(DEMO_LEADS);
}

export function getDemoTariffs(): Tariff[] {
  return normalizeTariffs([...BESTPAY_A920_TARIFFS_RAW]);
}

export function getDemoProducts(): Product[] {
  return normalizeProducts([...BESTPAY_PRODUCTS_RAW]);
}

export function isDemoDataSeeded(): boolean {
  return readStorageItem<boolean>(STORAGE_KEYS.seeded) === true;
}

export function seedDemoData(): void {
  if (isDemoDataSeeded()) {
    migrateTariffCatalogIfNeeded();
    migrateProductCatalogIfNeeded();
    migrateOfferStorageIfNeeded();
    migrateOfferDocumentStorageIfNeeded();
    migrateRecommendationCatalogIfNeeded();
    migrateRecommendationStorageIfNeeded();
    migrateBillingImportStorageIfNeeded();
    return;
  }

  migrateBillingImportStorageIfNeeded();

  writeStorageItem(STORAGE_KEYS.users, getDemoUsers());
  writeStorageItem(STORAGE_KEYS.leads, getDemoLeads());
  writeStorageItem(STORAGE_KEYS.tariffs, getDemoTariffs());
  writeStorageItem(STORAGE_KEYS.tariffCatalogVersion, CURRENT_TARIFF_CATALOG_VERSION);
  writeStorageItem(STORAGE_KEYS.products, getDemoProducts());
  writeStorageItem(STORAGE_KEYS.productCatalogVersion, CURRENT_PRODUCT_CATALOG_VERSION);
  writeStorageItem(STORAGE_KEYS.offers, []);
  writeStorageItem(STORAGE_KEYS.offerStorageVersion, CURRENT_OFFER_STORAGE_VERSION);
  writeStorageItem(STORAGE_KEYS.offerDocuments, []);
  writeStorageItem(STORAGE_KEYS.offerDocumentStorageVersion, CURRENT_OFFER_DOCUMENT_STORAGE_VERSION);
  writeStorageItem(STORAGE_KEYS.currentUserId, DEMO_USERS[0]?.id ?? '');
  writeStorageItem(STORAGE_KEYS.seeded, true);
}

export function resetDemoDataForTests(): void {
  writeStorageItem(STORAGE_KEYS.users, getDemoUsers());
  writeStorageItem(STORAGE_KEYS.leads, getDemoLeads());
  writeStorageItem(STORAGE_KEYS.tariffs, getDemoTariffs());
  writeStorageItem(STORAGE_KEYS.tariffCatalogVersion, CURRENT_TARIFF_CATALOG_VERSION);
  writeStorageItem(STORAGE_KEYS.products, getDemoProducts());
  writeStorageItem(STORAGE_KEYS.productCatalogVersion, CURRENT_PRODUCT_CATALOG_VERSION);
  writeStorageItem(STORAGE_KEYS.offers, []);
  writeStorageItem(STORAGE_KEYS.offerStorageVersion, CURRENT_OFFER_STORAGE_VERSION);
  writeStorageItem(STORAGE_KEYS.offerDocuments, []);
  writeStorageItem(STORAGE_KEYS.offerDocumentStorageVersion, CURRENT_OFFER_DOCUMENT_STORAGE_VERSION);
  writeStorageItem(STORAGE_KEYS.currentUserId, DEMO_USERS[0]?.id ?? '');
  writeStorageItem(STORAGE_KEYS.seeded, true);
}

export function clearDemoDataForTests(): void {
  for (const key of Object.values(STORAGE_KEYS)) {
    localStorage.removeItem(key);
  }
}
