export const BACKUP_FORMAT_VERSION = 1;

export interface BackupManifest {
  formatVersion: number;
  appVersion: string;
  createdAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
  includedAreas: string[];
  schemaVersions: Record<string, number>;
  checksum: string | null;
  recordCounts: Record<string, number>;
}

export interface BackupHistoryEntry {
  id: string;
  createdAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
  type: 'full' | 'partial';
  includedAreas: string[];
  formatVersion: number;
  status: 'completed' | 'failed';
  fileName: string;
}

export interface RestorePreview {
  valid: boolean;
  formatVersion: number | null;
  appVersion: string | null;
  includedAreas: string[];
  schemaVersions: Record<string, number>;
  conflicts: string[];
  damagedAreas: string[];
  warnings: string[];
  recordCounts: Record<string, number>;
  checksumValid: boolean | null;
}

export interface ExportMetadata {
  id: string;
  createdAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
  format: 'csv' | 'json';
  area: string;
  recordCount: number;
}
