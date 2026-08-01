import { useEffect, useState } from 'react';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import { hasPermission } from '../../domain/permission/permission';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { createUserContext } from '../../services/auditService';
import type { SalesCommissionSummary } from '../../services/commissionAdminService';
import styles from './SalesWorkspacePage.module.css';

function formatEuro(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

export function SalesCommissionPage() {
  const { currentUser } = useCurrentUser();
  const { commissionAdminService } = useServices();
  const [summary, setSummary] = useState<SalesCommissionSummary | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    if (!hasPermission(currentUser.role, 'commission.view')) {
      setForbidden(true);
      return;
    }
    const context = createUserContext({
      id: currentUser.id,
      role: currentUser.role,
      name: currentUser.name,
      status: currentUser.status,
    });
    void commissionAdminService.getSalesOverview(context).then((result) => {
      if ('error' in result) {
        setForbidden(true);
      } else {
        setSummary(result);
      }
    });
  }, [commissionAdminService, currentUser]);

  if (forbidden) {
    return (
      <section>
        <PageHeader title="Meine Provision" />
        <AccessDenied description="Sie haben keinen Zugriff auf Provisionsdaten." />
      </section>
    );
  }

  if (!summary) {
    return (
      <section>
        <PageHeader title="Meine Provision" />
        <EmptyState title="Wird geladen" description="Provisionsübersicht wird geladen…" />
      </section>
    );
  }

  return (
    <section>
      <PageHeader title="Meine Provision" subtitle="Nur eigene Daten – keine Bearbeitung" />
      <div className={styles.metricsGrid}>
        <article className={styles.metricCard}>
          <h2>Offen</h2>
          <p>{formatEuro(summary.openCents)}</p>
        </article>
        <article className={styles.metricCard}>
          <h2>Erwartet</h2>
          <p>{formatEuro(summary.expectedCents)}</p>
        </article>
        <article className={styles.metricCard}>
          <h2>Freigegeben</h2>
          <p>{formatEuro(summary.releasedCents)}</p>
        </article>
        <article className={styles.metricCard}>
          <h2>Ausgezahlt</h2>
          <p>{formatEuro(summary.paidCents)}</p>
        </article>
        <article className={styles.metricCard}>
          <h2>Sonderzahlungen</h2>
          <p>{formatEuro(summary.bonusCents)}</p>
        </article>
        <article className={styles.metricCard}>
          <h2>Kürzungen</h2>
          <p>{formatEuro(summary.reductionCents)}</p>
        </article>
      </div>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Summen</h2>
        <ul>
          <li>Monat: {formatEuro(summary.monthCents)}</li>
          <li>Jahr: {formatEuro(summary.yearCents)}</li>
          <li>Gesamt: {formatEuro(summary.totalCents)}</li>
        </ul>
      </section>
    </section>
  );
}
