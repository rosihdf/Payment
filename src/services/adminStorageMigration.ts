import { normalizeUsers } from '../domain/user/normalizeUser';
import { CURRENT_USER_SCHEMA_VERSION } from '../domain/user/normalizeUser';
import type { User } from '../domain/user/user';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { migrateApprovalRulesIfNeeded } from './approvalRuleStorageMigration';
import { migrateAuditStorageIfNeeded } from './auditStorageMigration';
import { migrateDocumentTemplatesIfNeeded } from './documentTemplateStorageMigration';

export const CURRENT_USER_STORAGE_VERSION = 2;
export const CURRENT_ADMIN_STORAGE_VERSION = 1;

const LEGACY_DEMO_EMAILS: Record<string, string> = {
  user_001: 'laura.berger@demo.local',
  user_002: 'thomas.klein@demo.local',
  user_003: 'sarah.hoffmann@demo.local',
  user_004: 'michael.weber@demo.local',
};

export function migrateUserStorageIfNeeded(): void {
  const currentVersion = readStorageItem<number>(STORAGE_KEYS.userStorageVersion) ?? 0;
  const rawUsers = readStorageItem<unknown[]>(STORAGE_KEYS.users) ?? [];
  const normalized = normalizeUsers(rawUsers);

  if (currentVersion < CURRENT_USER_STORAGE_VERSION || normalized.length !== rawUsers.length) {
    const migrated = normalized.map((user) => ({
      ...user,
      email: user.email.includes('@') ? user.email : LEGACY_DEMO_EMAILS[user.id] ?? `${user.id}@demo.local`,
      schemaVersion: CURRENT_USER_SCHEMA_VERSION,
    }));
    writeStorageItem(STORAGE_KEYS.users, migrated);
    writeStorageItem(STORAGE_KEYS.userStorageVersion, CURRENT_USER_STORAGE_VERSION);
  }
}

export function migrateAdminStorageIfNeeded(): void {
  migrateUserStorageIfNeeded();
  migrateAuditStorageIfNeeded();
  migrateApprovalRulesIfNeeded();
  migrateDocumentTemplatesIfNeeded();

  if (!readStorageItem(STORAGE_KEYS.backupHistory)) {
    writeStorageItem(STORAGE_KEYS.backupHistory, []);
  }
  if (!readStorageItem(STORAGE_KEYS.exportHistory)) {
    writeStorageItem(STORAGE_KEYS.exportHistory, []);
  }
  if (!readStorageItem(STORAGE_KEYS.diagnosticEvents)) {
    writeStorageItem(STORAGE_KEYS.diagnosticEvents, []);
  }

  const currentVersion = readStorageItem<number>(STORAGE_KEYS.adminStorageVersion) ?? 0;
  if (currentVersion < CURRENT_ADMIN_STORAGE_VERSION) {
    writeStorageItem(STORAGE_KEYS.adminStorageVersion, CURRENT_ADMIN_STORAGE_VERSION);
  }
}

export function resetAdminStorageForTests(): void {
  localStorage.removeItem(STORAGE_KEYS.auditEntries);
  localStorage.removeItem(STORAGE_KEYS.auditStorageVersion);
  localStorage.removeItem(STORAGE_KEYS.approvalRules);
  localStorage.removeItem(STORAGE_KEYS.approvalRuleStorageVersion);
  localStorage.removeItem(STORAGE_KEYS.documentTemplates);
  localStorage.removeItem(STORAGE_KEYS.documentTemplateStorageVersion);
  localStorage.removeItem(STORAGE_KEYS.backupHistory);
  localStorage.removeItem(STORAGE_KEYS.exportHistory);
  localStorage.removeItem(STORAGE_KEYS.diagnosticEvents);
  localStorage.removeItem(STORAGE_KEYS.userStorageVersion);
  localStorage.removeItem(STORAGE_KEYS.adminStorageVersion);
}

export function createDemoUserSeed(): User[] {
  const timestamp = '2026-01-01T00:00:00.000Z';
  return normalizeUsers([
    {
      id: 'user_001',
      name: 'Laura Berger',
      email: 'laura.berger@demo.local',
      role: 'field_service',
      status: 'active',
      salesTeamId: 'team_001',
      createdAt: timestamp,
      updatedAt: timestamp,
      deactivatedAt: null,
      lastAccessAt: null,
      schemaVersion: CURRENT_USER_SCHEMA_VERSION,
    },
    {
      id: 'user_002',
      name: 'Thomas Klein',
      email: 'thomas.klein@demo.local',
      role: 'field_service',
      status: 'active',
      salesTeamId: 'team_001',
      createdAt: timestamp,
      updatedAt: timestamp,
      deactivatedAt: null,
      lastAccessAt: null,
      schemaVersion: CURRENT_USER_SCHEMA_VERSION,
    },
    {
      id: 'user_003',
      name: 'Sarah Hoffmann',
      email: 'sarah.hoffmann@demo.local',
      role: 'sales_lead',
      status: 'active',
      salesTeamId: 'team_001',
      createdAt: timestamp,
      updatedAt: timestamp,
      deactivatedAt: null,
      lastAccessAt: null,
      schemaVersion: CURRENT_USER_SCHEMA_VERSION,
    },
    {
      id: 'user_004',
      name: 'Michael Weber',
      email: 'michael.weber@demo.local',
      role: 'admin',
      status: 'active',
      salesTeamId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      deactivatedAt: null,
      lastAccessAt: null,
      schemaVersion: CURRENT_USER_SCHEMA_VERSION,
    },
    {
      id: 'user_005',
      name: 'Eva Prüfer',
      email: 'eva.pruefer@demo.local',
      role: 'reviewer',
      status: 'active',
      salesTeamId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      deactivatedAt: null,
      lastAccessAt: null,
      schemaVersion: CURRENT_USER_SCHEMA_VERSION,
    },
    {
      id: 'user_006',
      name: 'Read Only',
      email: 'readonly@demo.local',
      role: 'readonly',
      status: 'active',
      salesTeamId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      deactivatedAt: null,
      lastAccessAt: null,
      schemaVersion: CURRENT_USER_SCHEMA_VERSION,
    },
  ]);
}
