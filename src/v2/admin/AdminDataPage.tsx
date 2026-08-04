import { useState } from 'react';
import { isSupabaseDataMode } from '../../config/dataMode';
import { EXPORTABLE_AREAS } from '../../services/dataExportService';
import type { MigrationPreview } from '../../services/supabaseDataMigrationService';
import type { ProductionCatalogBootstrapPreview } from '../../services/productionCatalogBootstrapService';
import { downloadBlob } from '../../utils/downloadBlob';
import { AdminLayout, useAdminContext } from '../../features/admin/AdminLayout';
import { useServices } from '../../hooks/useServices';
import { Button } from '../ui/Button';
import styles from '../../features/admin/AdminLayout.module.css';

function triggerTextDownload(content: string, filename: string, mimeType: string): void {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}

export function AdminDataPage() {
  const context = useAdminContext();
  const { dataExportService, dataRestoreService, supabaseDataMigrationService, productionCatalogBootstrapService } = useServices();
  const [message, setMessage] = useState<string | null>(null);
  const [restorePreview, setRestorePreview] = useState<string | null>(null);
  const [migrationPreview, setMigrationPreview] = useState<MigrationPreview | null>(null);
  const [migrationContent, setMigrationContent] = useState<string | null>(null);
  const [bootstrapPreview, setBootstrapPreview] = useState<ProductionCatalogBootstrapPreview | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

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

  const handleBootstrapPreview = async () => {
    if (!context) {
      return;
    }
    const result = await productionCatalogBootstrapService.preview(context);
    if (result.ok) {
      setBootstrapPreview(result.preview);
      setMessage(
        result.preview.totalToInsert > 0
          ? `Grundkonfiguration: ${result.preview.totalToInsert} Datensätze fehlen`
          : 'Grundkonfiguration vollständig – nichts zu importieren',
      );
    } else {
      setMessage('Grundkonfiguration-Vorschau nicht erlaubt');
    }
  };

  const handleBootstrapImport = async () => {
    if (!context) {
      return;
    }
    setIsBootstrapping(true);
    const result = await productionCatalogBootstrapService.execute(context);
    if (result.ok) {
      const inserted = Object.values(result.insertedCounts).reduce((sum, count) => sum + count, 0);
      setMessage(`Grundkonfiguration importiert (${inserted} neue Datensätze)`);
      setBootstrapPreview(result.preview);
    } else {
      setMessage('Grundkonfiguration-Import nicht erlaubt');
    }
    setIsBootstrapping(false);
  };

  return (
    <AdminLayout
      title="Daten und Sicherung"
      actions={
        <Button type="button" onClick={() => void handleBackup()}>
          Gesamtsicherung erstellen
        </Button>
      }
    >
      {message ? <p role="status">{message}</p> : null}
      <section className={styles.panel}>
        <h2>CSV-Exporte</h2>
        <div className={styles.toolbar}>
          {EXPORTABLE_AREAS.map((area) => (
            <Button key={area} type="button" variant="secondary" onClick={() => void handleCsvExport(area)}>
              {area}
            </Button>
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
          <h2>Grundkonfiguration</h2>
          <p>
            Produktive Ausgangskonfiguration (Tarife, Produkte, Provision, Preislisten, Freigaben,
            Vorlagen) idempotent importieren. Bestehende Datensätze werden nicht überschrieben.
          </p>
          <div className={styles.toolbar}>
            <Button type="button" variant="secondary" onClick={() => void handleBootstrapPreview()}>
              Vorschau
            </Button>
            <Button
              type="button"
              disabled={!bootstrapPreview || bootstrapPreview.totalToInsert === 0 || isBootstrapping}
              loading={isBootstrapping}
              onClick={() => void handleBootstrapImport()}
            >
              Grundkonfiguration importieren
            </Button>
          </div>
          {bootstrapPreview ? (
            <div role="status">
              <ul>
                {bootstrapPreview.areas
                  .filter((area) => area.toInsertCount > 0 || area.existingCount > 0)
                  .map((area) => (
                    <li key={area.areaKey}>
                      {area.label}: {area.existingCount} vorhanden
                      {area.toInsertCount > 0 ? `, ${area.toInsertCount} fehlen` : ''}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
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
              <Button type="button" variant="secondary" onClick={() => void handleMigrationPreviewFromLocal()}>
                LocalStorage-Vorschau
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={!migrationPreview || !migrationContent || isImporting}
              loading={isImporting}
              onClick={() => void handleMigrationImport()}
            >
              Import bestätigen
            </Button>
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
