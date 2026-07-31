import { loadAppRuntimeConfig, validateAppRuntimeConfig } from '../config/appRuntimeConfig';
import type { UserContext } from '../domain/user/user';
import { APP_VERSION } from '../utils/appInfo';
import { readStorageItem, STORAGE_KEYS } from '../utils/storage';
import { requirePermission } from './auditService';
import type { DataExportService } from './dataExportService';
import type { DataDiagnosticService } from './dataDiagnosticService';
import { CURRENT_ADMIN_STORAGE_VERSION } from './adminStorageMigration';
import { CURRENT_TARIFF_CATALOG_VERSION } from './tariffCatalogMigration';
import { CURRENT_PRODUCT_CATALOG_VERSION } from './productCatalogMigration';
import { CURRENT_OFFER_STORAGE_VERSION } from './offerStorageMigration';

export interface MigrationStatusEntry {
  store: string;
  currentVersion: number;
  expectedVersion: number;
  status: 'ok' | 'pending' | 'unknown';
}

export interface SystemHealthCheck {
  name: string;
  ok: boolean;
  message: string;
}

export interface SystemStatusView {
  appVersion: string;
  environment: string;
  persistenceMode: string;
  authMode: string;
  demoMode: boolean;
  storageReadable: boolean;
  storageWritable: boolean;
  estimatedDataSizeBytes: number;
  migrationStatus: MigrationStatusEntry[];
  lastBackupAt: string | null;
  lastExportAt: string | null;
  diagnosticIssueCount: number;
  configErrors: string[];
  healthChecks: SystemHealthCheck[];
}

export class SystemStatusService {
  private readonly dataExportService: DataExportService;
  private readonly dataDiagnosticService: DataDiagnosticService;

  constructor(dataExportService: DataExportService, dataDiagnosticService: DataDiagnosticService) {
    this.dataExportService = dataExportService;
    this.dataDiagnosticService = dataDiagnosticService;
  }

  async getStatus(context: UserContext): Promise<SystemStatusView | { error: 'forbidden' }> {
    const guard = requirePermission(context, 'admin.system');
    if (!guard.ok) {
      return { error: 'forbidden' };
    }

    const config = loadAppRuntimeConfig();
    const configErrors = validateAppRuntimeConfig(config);

    let storageReadable = false;
    let storageWritable = false;
    try {
      localStorage.getItem('amrtech.healthcheck');
      storageReadable = true;
      localStorage.setItem('amrtech.healthcheck', '1');
      storageWritable = true;
      localStorage.removeItem('amrtech.healthcheck');
    } catch {
      storageReadable = false;
      storageWritable = false;
    }

    let estimatedDataSizeBytes = 0;
    for (const key of Object.values(STORAGE_KEYS)) {
      const raw = localStorage.getItem(key);
      estimatedDataSizeBytes += raw?.length ?? 0;
    }

    const backupHistory = this.dataExportService.getBackupHistory();
    const exportHistory = this.dataExportService.getExportHistory();
    const diagnostics = await this.dataDiagnosticService.runDiagnostics(context);
    const diagnosticIssueCount = Array.isArray(diagnostics) ? diagnostics.length : 0;

    const migrationStatus: MigrationStatusEntry[] = [
      {
        store: 'admin',
        currentVersion: readStorageItem<number>(STORAGE_KEYS.adminStorageVersion) ?? 0,
        expectedVersion: CURRENT_ADMIN_STORAGE_VERSION,
        status:
          (readStorageItem<number>(STORAGE_KEYS.adminStorageVersion) ?? 0) >= CURRENT_ADMIN_STORAGE_VERSION
            ? 'ok'
            : 'pending',
      },
      {
        store: 'tariffs',
        currentVersion: readStorageItem<number>(STORAGE_KEYS.tariffCatalogVersion) ?? 0,
        expectedVersion: CURRENT_TARIFF_CATALOG_VERSION,
        status:
          (readStorageItem<number>(STORAGE_KEYS.tariffCatalogVersion) ?? 0) >= CURRENT_TARIFF_CATALOG_VERSION
            ? 'ok'
            : 'pending',
      },
      {
        store: 'products',
        currentVersion: readStorageItem<number>(STORAGE_KEYS.productCatalogVersion) ?? 0,
        expectedVersion: CURRENT_PRODUCT_CATALOG_VERSION,
        status:
          (readStorageItem<number>(STORAGE_KEYS.productCatalogVersion) ?? 0) >= CURRENT_PRODUCT_CATALOG_VERSION
            ? 'ok'
            : 'pending',
      },
      {
        store: 'offers',
        currentVersion: readStorageItem<number>(STORAGE_KEYS.offerStorageVersion) ?? 0,
        expectedVersion: CURRENT_OFFER_STORAGE_VERSION,
        status:
          (readStorageItem<number>(STORAGE_KEYS.offerStorageVersion) ?? 0) >= CURRENT_OFFER_STORAGE_VERSION
            ? 'ok'
            : 'pending',
      },
    ];

    const healthChecks: SystemHealthCheck[] = [
      { name: 'localStorage lesbar', ok: storageReadable, message: storageReadable ? 'OK' : 'Fehler' },
      { name: 'localStorage schreibbar', ok: storageWritable, message: storageWritable ? 'OK' : 'Fehler' },
      {
        name: 'Persistenzmodus',
        ok: config.persistenceMode === 'local',
        message: 'Lokaler Datenmodus',
      },
      {
        name: 'Konfiguration',
        ok: configErrors.length === 0,
        message: configErrors.length === 0 ? 'OK' : configErrors.join('; '),
      },
    ];

    return {
      appVersion: APP_VERSION,
      environment: config.environment,
      persistenceMode: config.persistenceMode,
      authMode: config.authMode,
      demoMode: config.demoMode,
      storageReadable,
      storageWritable,
      estimatedDataSizeBytes,
      migrationStatus,
      lastBackupAt: backupHistory[0]?.createdAt ?? null,
      lastExportAt: exportHistory[0]?.createdAt ?? null,
      diagnosticIssueCount,
      configErrors,
      healthChecks,
    };
  }
}
