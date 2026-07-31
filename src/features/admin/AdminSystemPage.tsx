import { useEffect, useState } from 'react';
import type { DiagnosticFinding } from '../../domain/diagnostic/diagnosticFinding';
import { DIAGNOSTIC_SEVERITY_LABELS } from '../../domain/diagnostic/diagnosticFinding';
import { EmptyState } from '../../components/feedback/EmptyState';
import { AdminLayout, useAdminContext } from './AdminLayout';
import { useServices } from '../../hooks/useServices';
import type { SystemStatusView } from '../../services/systemStatusService';
import styles from './AdminLayout.module.css';

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
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Store</th>
                    <th>Aktuell</th>
                    <th>Erwartet</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {status.migrationStatus.map((entry) => (
                    <tr key={entry.store}>
                      <td>{entry.store}</td>
                      <td>{entry.currentVersion}</td>
                      <td>{entry.expectedVersion}</td>
                      <td>{entry.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.panel}>
            <h2>Diagnose ({findings.length})</h2>
            {findings.length === 0 ? (
              <p>Keine Integritätsprobleme erkannt.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Schweregrad</th>
                      <th>Bereich</th>
                      <th>Beschreibung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {findings.slice(0, 20).map((finding) => (
                      <tr key={finding.id}>
                        <td>{DIAGNOSTIC_SEVERITY_LABELS[finding.severity]}</td>
                        <td>{finding.area}</td>
                        <td>{finding.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </AdminLayout>
  );
}
