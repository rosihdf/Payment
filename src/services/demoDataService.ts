import { normalizeLeads } from '../domain/lead/normalizeLead';
import { normalizeTariffs } from '../domain/tariff/normalizeTariff';
import type { Lead } from '../domain/lead/lead';
import type { Tariff } from '../domain/tariff/tariff';
import type { User } from '../domain/user/user';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';

const DEMO_USERS: User[] = [
  { id: 'user_001', name: 'Laura Berger', role: 'field_service' },
  { id: 'user_002', name: 'Thomas Klein', role: 'field_service' },
  { id: 'user_003', name: 'Sarah Hoffmann', role: 'field_service' },
  { id: 'user_004', name: 'Michael Weber', role: 'admin' },
];

const DEMO_TARIFFS_RAW = [
  {
    id: 'tariff_001',
    name: 'BestPay Start',
    providerName: 'BestPay',
    productCode: 'BP-START',
    description: 'Demo-Tarif für stationäre Kartenterminals im Einzelhandel.',
    status: 'active',
    supportedTerminalTypes: ['stationary'],
    monthlyBaseFeeCents: 990,
    monthlyTerminalFeeCents: 490,
    setupFeeCents: 0,
    minimumMonthlyFeeCents: null,
    minimumContractMonths: 12,
    noticePeriodMonths: 3,
    includedTransactions: 500,
    additionalTransactionFeeCents: 5,
    cardRates: {
      girocard: { percentageBasisPoints: 25, fixedFeeCents: 9 },
      debit: { percentageBasisPoints: 119, fixedFeeCents: 12 },
      credit: { percentageBasisPoints: 189, fixedFeeCents: 12 },
      other: { percentageBasisPoints: 0, fixedFeeCents: 0 },
    },
    billingInterval: 'monthly',
    validFrom: '2026-01-01',
    validUntil: null,
    notes: 'Demo-Daten für stationären Basistarif.',
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z',
  },
  {
    id: 'tariff_002',
    name: 'BestPay Business',
    providerName: 'BestPay',
    productCode: 'BP-BUSINESS',
    description: 'Demo-Tarif für mobile Kartenterminals im Außendienst.',
    status: 'active',
    supportedTerminalTypes: ['mobile'],
    monthlyBaseFeeCents: 1490,
    monthlyTerminalFeeCents: 790,
    setupFeeCents: 4900,
    minimumMonthlyFeeCents: 1990,
    minimumContractMonths: 24,
    noticePeriodMonths: 3,
    includedTransactions: 1000,
    additionalTransactionFeeCents: 4,
    cardRates: {
      girocard: { percentageBasisPoints: 22, fixedFeeCents: 8 },
      debit: { percentageBasisPoints: 109, fixedFeeCents: 10 },
      credit: { percentageBasisPoints: 175, fixedFeeCents: 10 },
      other: { percentageBasisPoints: 50, fixedFeeCents: 5 },
    },
    billingInterval: 'monthly',
    validFrom: '2026-01-01',
    validUntil: '2027-12-31',
    notes: 'Demo-Daten für mobilen Tarif.',
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-07-20T11:30:00.000Z',
  },
  {
    id: 'tariff_003',
    name: 'BestPay Flex',
    active: false,
    productCode: 'BP-FLEX',
    description: 'Demo-Tarif für SoftPOS und E-Commerce.',
    supportedTerminalTypes: ['softpos', 'ecommerce'],
    monthlyBaseFeeCents: 0,
    monthlyTerminalFeeCents: 0,
    setupFeeCents: 9900,
    includedTransactions: null,
    additionalTransactionFeeCents: 8,
    cardRates: {
      girocard: { percentageBasisPoints: 30, fixedFeeCents: 10 },
      debit: { percentageBasisPoints: 125, fixedFeeCents: 15 },
      credit: { percentageBasisPoints: 199, fixedFeeCents: 15 },
      other: { percentageBasisPoints: 0, fixedFeeCents: 0 },
    },
    billingInterval: 'monthly',
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-07-10T09:00:00.000Z',
  },
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
  return normalizeTariffs(DEMO_TARIFFS_RAW);
}

export function isDemoDataSeeded(): boolean {
  return readStorageItem<boolean>(STORAGE_KEYS.seeded) === true;
}

export function seedDemoData(): void {
  if (isDemoDataSeeded()) {
    return;
  }

  writeStorageItem(STORAGE_KEYS.users, getDemoUsers());
  writeStorageItem(STORAGE_KEYS.leads, getDemoLeads());
  writeStorageItem(STORAGE_KEYS.tariffs, getDemoTariffs());
  writeStorageItem(STORAGE_KEYS.currentUserId, DEMO_USERS[0]?.id ?? '');
  writeStorageItem(STORAGE_KEYS.seeded, true);
}

export function resetDemoDataForTests(): void {
  writeStorageItem(STORAGE_KEYS.users, getDemoUsers());
  writeStorageItem(STORAGE_KEYS.leads, getDemoLeads());
  writeStorageItem(STORAGE_KEYS.tariffs, getDemoTariffs());
  writeStorageItem(STORAGE_KEYS.currentUserId, DEMO_USERS[0]?.id ?? '');
  writeStorageItem(STORAGE_KEYS.seeded, true);
}

export function clearDemoDataForTests(): void {
  localStorage.removeItem(STORAGE_KEYS.users);
  localStorage.removeItem(STORAGE_KEYS.leads);
  localStorage.removeItem(STORAGE_KEYS.tariffs);
  localStorage.removeItem(STORAGE_KEYS.currentUserId);
  localStorage.removeItem(STORAGE_KEYS.seeded);
  localStorage.removeItem(STORAGE_KEYS.leadDrafts);
  localStorage.removeItem(STORAGE_KEYS.leadEditDrafts);
}
