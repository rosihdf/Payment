import { BACKUP_FORMAT_VERSION, type BackupHistoryEntry, type ExportMetadata } from '../domain/backup/backupManifest';
import type { UserContext } from '../domain/user/user';
import { APP_VERSION } from '../utils/appInfo';
import { generateId, nowIso } from '../utils/id';
import { readStorageItem, STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import type { AuditService } from './auditService';
import { requirePermission } from './auditService';
import { CURRENT_ADMIN_STORAGE_VERSION } from './adminStorageMigration';
import { CURRENT_AUDIT_STORAGE_VERSION } from './auditStorageMigration';
import { CURRENT_TARIFF_CATALOG_VERSION } from './tariffCatalogMigration';
import { CURRENT_PRODUCT_CATALOG_VERSION } from './productCatalogMigration';
import { CURRENT_OFFER_STORAGE_VERSION } from './offerStorageMigration';

const EXPORTABLE_AREAS = [
  'users',
  'leads',
  'offers',
  'offerVersions',
  'tasks',
  'activities',
  'tariffs',
  'products',
  'approvalRules',
  'audit',
] as const;

export type ExportArea = (typeof EXPORTABLE_AREAS)[number];

const AREA_STORAGE_MAP: Record<ExportArea, string> = {
  users: STORAGE_KEYS.users,
  leads: STORAGE_KEYS.leads,
  offers: STORAGE_KEYS.offers,
  offerVersions: STORAGE_KEYS.offerVersions,
  tasks: STORAGE_KEYS.salesTasks,
  activities: STORAGE_KEYS.salesActivities,
  tariffs: STORAGE_KEYS.tariffs,
  products: STORAGE_KEYS.products,
  approvalRules: STORAGE_KEYS.approvalRules,
  audit: STORAGE_KEYS.auditEntries,
};

const FULL_BACKUP_KEYS = Object.values(STORAGE_KEYS).filter(
  (key) =>
    !key.includes('Version') &&
    key !== STORAGE_KEYS.seeded &&
    key !== STORAGE_KEYS.currentUserId,
);

function simpleChecksum(payload: string): string {
  let hash = 0;
  for (let index = 0; index < payload.length; index += 1) {
    hash = (hash * 31 + payload.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function readAreaData(area: ExportArea): unknown[] {
  const raw = readStorageItem<unknown[]>(AREA_STORAGE_MAP[area]);
  return Array.isArray(raw) ? raw : [];
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return '';
  }
  const headers = Object.keys(rows[0] ?? {});
  const lines = [headers.join(';')];
  for (const row of rows) {
    lines.push(headers.map((header) => JSON.stringify(row[header] ?? '')).join(';'));
  }
  return lines.join('\n');
}

export class DataExportService {
  private readonly auditService: AuditService;

  constructor(auditService: AuditService) {
    this.auditService = auditService;
  }

  async exportCsv(
    context: UserContext,
    area: ExportArea,
  ): Promise<{ ok: true; content: string; metadata: ExportMetadata } | { ok: false; error: 'forbidden' }> {
    const guard = requirePermission(context, 'admin.export');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const data = readAreaData(area);
    const flatRows = data.map((entry) =>
      typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : { value: entry },
    );
    const content = toCsv(flatRows);
    const metadata = this.recordExport(context, 'csv', area, data.length);
    await this.auditService.logChange({
      context,
      action: 'export',
      entityType: 'export',
      entityId: metadata.id,
      summary: `CSV-Export ${area} (${data.length} Datensätze)`,
    });
    return { ok: true, content, metadata };
  }

  async exportFullBackup(
    context: UserContext,
  ): Promise<
    | { ok: true; content: string; metadata: BackupHistoryEntry; manifest: Record<string, unknown> }
    | { ok: false; error: 'forbidden' }
  > {
    const guard = requirePermission(context, 'admin.backup');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const payload: Record<string, unknown> = {};
    const recordCounts: Record<string, number> = {};

    for (const key of FULL_BACKUP_KEYS) {
      const value = readStorageItem(key);
      payload[key] = value;
      recordCounts[key] = Array.isArray(value) ? value.length : value ? 1 : 0;
    }

    const manifestBase = {
      formatVersion: BACKUP_FORMAT_VERSION,
      appVersion: APP_VERSION,
      createdAt: nowIso(),
      createdByUserId: context.userId,
      createdByDisplayName: context.displayName,
      includedAreas: FULL_BACKUP_KEYS,
      schemaVersions: {
        admin: CURRENT_ADMIN_STORAGE_VERSION,
        audit: CURRENT_AUDIT_STORAGE_VERSION,
        tariffs: CURRENT_TARIFF_CATALOG_VERSION,
        products: CURRENT_PRODUCT_CATALOG_VERSION,
        offers: CURRENT_OFFER_STORAGE_VERSION,
      },
      recordCounts,
      checksum: null as string | null,
    };

    const serializedForChecksum = JSON.stringify({ manifest: manifestBase, payload }, null, 2);
    const checksum = simpleChecksum(serializedForChecksum);
    const manifest = { ...manifestBase, checksum };

    const serialized = JSON.stringify({ manifest, payload }, null, 2);

    const metadata: BackupHistoryEntry = {
      id: generateId('backup'),
      createdAt: manifest.createdAt as string,
      createdByUserId: context.userId,
      createdByDisplayName: context.displayName,
      type: 'full',
      includedAreas: FULL_BACKUP_KEYS,
      formatVersion: BACKUP_FORMAT_VERSION,
      status: 'completed',
      fileName: `amrtech-backup-${manifest.createdAt}.json`,
    };

    const history = readStorageItem<BackupHistoryEntry[]>(STORAGE_KEYS.backupHistory) ?? [];
    history.unshift(metadata);
    writeStorageItem(STORAGE_KEYS.backupHistory, history.slice(0, 50));

    await this.auditService.logChange({
      context,
      action: 'backup',
      entityType: 'backup',
      entityId: metadata.id,
      summary: `Gesamtsicherung erstellt (${FULL_BACKUP_KEYS.length} Bereiche)`,
    });

    return {
      ok: true,
      content: serialized,
      metadata,
      manifest,
    };
  }

  getExportHistory(): ExportMetadata[] {
    return readStorageItem<ExportMetadata[]>(STORAGE_KEYS.exportHistory) ?? [];
  }

  getBackupHistory(): BackupHistoryEntry[] {
    return readStorageItem<BackupHistoryEntry[]>(STORAGE_KEYS.backupHistory) ?? [];
  }

  private recordExport(
    context: UserContext,
    format: ExportMetadata['format'],
    area: string,
    recordCount: number,
  ): ExportMetadata {
    const metadata: ExportMetadata = {
      id: generateId('export'),
      createdAt: nowIso(),
      createdByUserId: context.userId,
      createdByDisplayName: context.displayName,
      format,
      area,
      recordCount,
    };
    const history = this.getExportHistory();
    history.unshift(metadata);
    writeStorageItem(STORAGE_KEYS.exportHistory, history.slice(0, 100));
    return metadata;
  }
}

export class DataRestoreService {
  private readonly auditService: AuditService;

  constructor(auditService: AuditService) {
    this.auditService = auditService;
  }

  previewRestore(content: string): import('../domain/backup/backupManifest').RestorePreview {
    try {
      const parsed = JSON.parse(content) as {
        manifest?: Record<string, unknown>;
        payload?: Record<string, unknown>;
      };

      if (!parsed.manifest || !parsed.payload) {
        return {
          valid: false,
          formatVersion: null,
          appVersion: null,
          includedAreas: [],
          schemaVersions: {},
          conflicts: ['Ungültiges Sicherungsformat.'],
          damagedAreas: [],
          warnings: [],
          recordCounts: {},
          checksumValid: null,
        };
      }

      const formatVersion =
        typeof parsed.manifest.formatVersion === 'number' ? parsed.manifest.formatVersion : null;

      if (formatVersion !== BACKUP_FORMAT_VERSION) {
        return {
          valid: false,
          formatVersion,
          appVersion: typeof parsed.manifest.appVersion === 'string' ? parsed.manifest.appVersion : null,
          includedAreas: [],
          schemaVersions: {},
          conflicts: [`Unbekannte Formatversion ${String(formatVersion)}.`],
          damagedAreas: [],
          warnings: [],
          recordCounts: {},
          checksumValid: false,
        };
      }

      const includedAreas = Array.isArray(parsed.manifest.includedAreas)
        ? parsed.manifest.includedAreas.filter((area): area is string => typeof area === 'string')
        : [];

      const recordCounts: Record<string, number> = {};
      const damagedAreas: string[] = [];

      for (const area of includedAreas) {
        const value = parsed.payload[area];
        if (value === undefined) {
          damagedAreas.push(area);
          continue;
        }
        recordCounts[area] = Array.isArray(value) ? value.length : 1;
      }

      const manifestData = parsed.manifest ?? {};
      const payloadData = parsed.payload ?? {};
      const manifestWithoutChecksum = { ...manifestData, checksum: null };
      const serializedForChecksum = JSON.stringify(
        { manifest: manifestWithoutChecksum, payload: payloadData },
        null,
        2,
      );
      const checksumValid =
        typeof manifestData.checksum === 'string'
          ? manifestData.checksum === simpleChecksum(serializedForChecksum)
          : null;

      return {
        valid: damagedAreas.length === 0,
        formatVersion,
        appVersion: typeof parsed.manifest.appVersion === 'string' ? parsed.manifest.appVersion : null,
        includedAreas,
        schemaVersions:
          typeof parsed.manifest.schemaVersions === 'object' && parsed.manifest.schemaVersions
            ? (parsed.manifest.schemaVersions as Record<string, number>)
            : {},
        conflicts: damagedAreas.length > 0 ? ['Fehlende Bereiche in der Sicherung.'] : [],
        damagedAreas,
        warnings: checksumValid === false ? ['Prüfsumme stimmt nicht.'] : [],
        recordCounts,
        checksumValid,
      };
    } catch {
      return {
        valid: false,
        formatVersion: null,
        appVersion: null,
        includedAreas: [],
        schemaVersions: {},
        conflicts: ['Datei ist beschädigt oder kein gültiges JSON.'],
        damagedAreas: [],
        warnings: [],
        recordCounts: {},
        checksumValid: false,
      };
    }
  }

  async previewRestoreWithAudit(
    context: UserContext,
    content: string,
  ): Promise<
    | { ok: true; preview: import('../domain/backup/backupManifest').RestorePreview }
    | { ok: false; error: 'forbidden' }
  > {
    const guard = requirePermission(context, 'admin.backup');
    if (!guard.ok) {
      return { ok: false, error: 'forbidden' };
    }

    const preview = this.previewRestore(content);
    await this.auditService.logChange({
      context,
      action: 'restore_preview',
      entityType: 'backup',
      entityId: 'restore_preview',
      summary: preview.valid ? 'Restore-Vorprüfung erfolgreich' : 'Restore-Vorprüfung fehlgeschlagen',
    });

    return { ok: true, preview };
  }
}

export { EXPORTABLE_AREAS, FULL_BACKUP_KEYS };
