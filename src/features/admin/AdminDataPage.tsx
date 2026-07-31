import { useState } from 'react';
import { EXPORTABLE_AREAS } from '../../services/dataExportService';
import { downloadBlob } from '../../utils/downloadBlob';
import { AdminLayout, useAdminContext } from './AdminLayout';
import { useServices } from '../../hooks/useServices';
import styles from './AdminLayout.module.css';

function triggerTextDownload(content: string, filename: string, mimeType: string): void {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}

export function AdminDataPage() {
  const context = useAdminContext();
  const { dataExportService, dataRestoreService } = useServices();
  const [message, setMessage] = useState<string | null>(null);
  const [restorePreview, setRestorePreview] = useState<string | null>(null);

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
    </AdminLayout>
  );
}
