import { useEffect, useState } from 'react';
import type { DiagnosticFinding } from '../../domain/diagnostic/diagnosticFinding';
import { DIAGNOSTIC_SEVERITY_LABELS } from '../../domain/diagnostic/diagnosticFinding';
import { EmptyState } from '../../components/feedback/EmptyState';
import { AdminLayout, useAdminContext } from '../../features/admin/AdminLayout';
import { useServices } from '../../hooks/useServices';
import type { SystemStatusView } from '../../services/systemStatusService';
import { ResponsiveTable, type ResponsiveTableColumn } from '../ui/ResponsiveTable';
import styles from '../../features/admin/AdminLayout.module.css';

export function AdminSystemPage() {
  const context = useAdminContext();
  const { systemStatusService, dataDiagnosticService } = useServices();
  const [status, setStatus] = useState<SystemStatusView | null>(null);
  const [findings, setFindings] = useState<DiagnosticFinding[]>([]);

  useEffect(() => {
    if (!context) {
      return;
    }
    void systemStatusService.getStatus(context).then((result) => {
      if (!('error' in result)) {
        setStatus(result);
      }
    });
    void dataDiagnosticService.runDiagnostics(context).then((result) => {
      if (Array.isArray(result)) {
        setFindings(result);
      }
    });
  }, [context, dataDiagnosticService, systemStatusService]);

  const migrationColumns: ResponsiveTableColumn<SystemStatusView['migrationStatus'][number]>[] = [
    { id: 'store', header: 'Store', render: (entry) => entry.store },
    { id: 'current', header: 'Aktuell', render: (entry) => entry.currentVersion, numeric: true },
    { id: 'expected', header: 'Erwartet', render: (entry) => entry.expectedVersion, numeric: true },
    { id: 'status', header: 'Status', render: (entry) => entry.status },
  ];

  const findingColumns: ResponsiveTableColumn<DiagnosticFinding>[] = [
    { id: 'severity', header: 'Schweregrad', render: (finding) => DIAGNOSTIC_SEVERITY_LABELS[finding.severity] },
    { id: 'area', header: 'Bereich', render: (finding) => finding.area },
    { id: 'description', header: 'Beschreibung', render: (finding) => finding.description },
  ];

  return (
    <AdminLayout title="Systemstatus">
      {!status ? (
        <EmptyState title="Systemstatus wird geladen" description="Health Checks werden ausgeführt." />
      ) : (
        <>
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{status.appVersion}</div>
              <div className={styles.metricLabel}>App-Version</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{status.environment}</div>
              <div className={styles.metricLabel}>Umgebung</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{status.persistenceMode}</div>
              <div className={styles.metricLabel}>Persistenzmodus</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{Math.round(status.estimatedDataSizeBytes / 1024)} KB</div>
              <div className={styles.metricLabel}>Lokale Datengröße</div>
            </div>
          </div>

          <section className={styles.panel}>
            <h2>Health Checks</h2>
            <ul className={styles.hintList}>
              {status.healthChecks.map((check) => (
                <li key={check.name}>
                  {check.name}: {check.message}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>Migrationen</h2>
            <ResponsiveTable
              ariaLabel="Migrationsstatus"
              columns={migrationColumns}
              rows={status.migrationStatus}
              rowKey={(entry) => entry.store}
            />
          </section>

          <section className={styles.panel}>
            <h2>Diagnose ({findings.length})</h2>
            {findings.length === 0 ? (
              <p>Keine Integritätsprobleme erkannt.</p>
            ) : (
              <ResponsiveTable
                ariaLabel="Diagnosebefunde"
                columns={findingColumns}
                rows={findings.slice(0, 20)}
                rowKey={(finding) => finding.id}
              />
            )}
          </section>
        </>
      )}
    </AdminLayout>
  );
}
