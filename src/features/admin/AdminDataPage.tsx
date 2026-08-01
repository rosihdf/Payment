import { useState } from 'react';
import { isSupabaseDataMode } from '../../config/dataMode';
import { EXPORTABLE_AREAS } from '../../services/dataExportService';
import type { MigrationPreview } from '../../services/supabaseDataMigrationService';
import { downloadBlob } from '../../utils/downloadBlob';
import { AdminLayout, useAdminContext } from './AdminLayout';
import { useServices } from '../../hooks/useServices';
import styles from './AdminLayout.module.css';

function triggerTextDownload(content: string, filename: string, mimeType: string): void {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}

export function AdminDataPage() {
  const context = useAdminContext();
  const { dataExportService, dataRestoreService, supabaseDataMigrationService } = useServices();
  const [message, setMessage] = useState<string | null>(null);
  const [restorePreview, setRestorePreview] = useState<string | null>(null);
  const [migrationPreview, setMigrationPreview] = useState<MigrationPreview | null>(null);
  const [migrationContent, setMigrationContent] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleBackup = async () => {
    if (!context) {
      return;
    }
    const result = await dataExportService.exportFullBackup(context);
    if (result.ok) {
      triggerTextDownload(result.content, result.metadata.fileName, 'application/json');
      setMessage(`Sicherung heruntergeladen: ${result.metadata.fileName}`);
    } else {
      setMessage(result.error);
    }
  };

  const handleCsvExport = async (area: (typeof EXPORTABLE_AREAS)[number]) => {
    if (!context) {
      return;
    }
    const result = await dataExportService.exportCsv(context, area);
    if (result.ok) {
      triggerTextDownload(result.content, `amrtech-export-${area}.csv`, 'text/csv;charset=utf-8');
      setMessage(`CSV-Export ${area}: ${result.metadata.recordCount} Datensätze heruntergeladen`);
    }
  };

  const handleRestorePreview = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!context) {
      return;
    }
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const content = await file.text();
    const result = await dataRestoreService.previewRestoreWithAudit(context, content);
    if (result.ok) {
      setRestorePreview(
        result.preview.valid
          ? `Restore-Vorprüfung OK (${result.preview.includedAreas.length} Bereiche)`
          : `Restore blockiert: ${result.preview.conflicts.join('; ')}`,
      );
    }
  };

  const handleMigrationPreview = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!context) {
      return;
    }
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const content = await file.text();
    setMigrationContent(content);
    const result = await supabaseDataMigrationService.previewFromContent(context, content);
    if (result.ok) {
      setMigrationPreview(result.preview);
      setMessage(`Cloud-Migration Vorschau: ${result.preview.areas.length} Bereiche`);
    } else {
      setMigrationPreview(null);
      setMessage(`Cloud-Migration Vorschau fehlgeschlagen: ${result.error}`);
    }
  };

  const handleMigrationPreviewFromLocal = async () => {
    if (!context) {
      return;
    }
    const result = await supabaseDataMigrationService.previewFromLocalStorage(context);
    if (result.ok) {
      setMigrationPreview(result.preview);
      setMigrationContent(null);
      setMessage(`Cloud-Migration Vorschau aus LocalStorage (${result.preview.areas.length} Bereiche)`);
    } else {
      setMessage(`LocalStorage-Vorschau fehlgeschlagen: ${result.error}`);
    }
  };

  const handleMigrationImport = async () => {
    if (!context || !migrationContent || !migrationPreview) {
      return;
    }
    setIsImporting(true);
    const result = await supabaseDataMigrationService.executeImport(
      context,
      migrationContent,
      migrationPreview.runId,
    );
    if (result.ok) {
      setMessage(`Cloud-Migration abgeschlossen (Run ${result.runId})`);
      setMigrationPreview(null);
      setMigrationContent(null);
    } else {
      setMessage(result.message ?? `Cloud-Migration fehlgeschlagen: ${result.error}`);
    }
    setIsImporting(false);
  };

  return (
    <AdminLayout
      title="Daten und Sicherung"
      actions={
        <button type="button" onClick={() => void handleBackup()}>
          Gesamtsicherung erstellen
        </button>
      }
    >
      {message ? <p role="status">{message}</p> : null}
      <section className={styles.panel}>
        <h2>CSV-Exporte</h2>
        <div className={styles.toolbar}>
          {EXPORTABLE_AREAS.map((area) => (
            <button key={area} type="button" onClick={() => void handleCsvExport(area)}>
              {area}
            </button>
          ))}
        </div>
      </section>
      <section className={styles.panel}>
        <h2>Restore-Vorprüfung</h2>
        <input type="file" accept="application/json" onChange={(event) => void handleRestorePreview(event)} />
        {restorePreview ? <p role="status">{restorePreview}</p> : null}
        <p>Es erfolgt keine Datenmutation vor expliziter Bestätigung.</p>
      </section>
      {isSupabaseDataMode() ? (
        <section className={styles.panel}>
          <h2>Cloud-Migration</h2>
          <p>LocalStorage-Backup in Supabase importieren (idempotent, ohne Abrechnungs-Binärdateien).</p>
          <div className={styles.toolbar}>
            <input
              type="file"
              accept="application/json"
              onChange={(event) => void handleMigrationPreview(event)}
            />
            {!import.meta.env.PROD ? (
              <button type="button" onClick={() => void handleMigrationPreviewFromLocal()}>
                LocalStorage-Vorschau
              </button>
            ) : null}
            <button
              type="button"
              disabled={!migrationPreview || !migrationContent || isImporting}
              onClick={() => void handleMigrationImport()}
            >
              Import bestätigen
            </button>
          </div>
          {migrationPreview ? (
            <div role="status">
              <p>
                Quelle: {migrationPreview.source} · Run {migrationPreview.runId}
              </p>
              <ul>
                {migrationPreview.areas
                  .filter((area) => area.recordCount > 0)
                  .map((area) => (
                    <li key={area.areaKey}>
                      {area.label}: {area.recordCount} Datensätze
                      {area.conflictCount > 0 ? ` (${area.conflictCount} Konflikte)` : ''}
                    </li>
                  ))}
              </ul>
              {migrationPreview.warnings.length > 0 ? (
                <p>Hinweise: {migrationPreview.warnings.join('; ')}</p>
              ) : null}
              {migrationPreview.conflicts.length > 0 ? (
                <p>Konflikte: {migrationPreview.conflicts.join('; ')}</p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </AdminLayout>
  );
}
