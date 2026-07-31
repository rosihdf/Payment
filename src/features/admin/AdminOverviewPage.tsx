import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { AdminLayout, useAdminContext } from './AdminLayout';
import { useServices } from '../../hooks/useServices';
import type { AdminOverviewMetrics } from '../../services/adminOverviewService';
import styles from './AdminLayout.module.css';

export function AdminOverviewPage() {
  const context = useAdminContext();
  const { adminOverviewService } = useServices();
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!context) {
      return;
    }
    void adminOverviewService.getOverview(context).then((result) => {
      if ('error' in result) {
        setError('Keine Berechtigung');
        return;
      }
      setMetrics(result);
    });
  }, [adminOverviewService, context]);

  return (
    <AdminLayout title="Administration">
      {error ? (
        <EmptyState title="Keine Berechtigung" description={error} />
      ) : !metrics ? (
        <EmptyState title="Übersicht wird geladen" description="Administrative Kennzahlen werden ermittelt." />
      ) : (
        <>
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{metrics.activeUsers}</div>
              <div className={styles.metricLabel}>Aktive Benutzer</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{metrics.deactivatedUsers}</div>
              <div className={styles.metricLabel}>Deaktivierte Benutzer</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{metrics.activeTariffs}</div>
              <div className={styles.metricLabel}>Aktive Tarife</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{metrics.diagnosticIssues}</div>
              <div className={styles.metricLabel}>Diagnosehinweise</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{metrics.approvalRuleConflicts}</div>
              <div className={styles.metricLabel}>Regelkonflikte</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>{metrics.invalidCommissionPlans}</div>
              <div className={styles.metricLabel}>Provision offen</div>
            </div>
          </div>

          <section className={styles.panel}>
            <h2>Administrative Hinweise</h2>
            <ul className={styles.hintList}>
              {metrics.administrativeHints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>Schnellzugriff</h2>
            <div className={styles.toolbar}>
              <Link to="/admin/users">Benutzer verwalten</Link>
              <Link to="/admin/data">Daten sichern</Link>
              <Link to="/admin/system">Systemstatus prüfen</Link>
              <Link to="/admin/pricing">Tarife & Preise</Link>
            </div>
          </section>
        </>
      )}
    </AdminLayout>
  );
}
