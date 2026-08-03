import { useEffect, useState } from 'react';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { EmptyState } from '../../components/feedback/EmptyState';
import { hasPermission } from '../../domain/permission/permission';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { createUserContext } from '../../services/auditService';
import type { SalesCommissionSummary } from '../../services/commissionAdminService';
import { PageHeader } from '../ui/PageHeader';
import { formatEuro } from './CommissionShell';
import styles from './CommissionPage.module.css';

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

  const metrics = [
    { label: 'Offen', value: formatEuro(summary.openCents) },
    { label: 'Erwartet', value: formatEuro(summary.expectedCents) },
    { label: 'Freigegeben', value: formatEuro(summary.releasedCents) },
    { label: 'Ausgezahlt', value: formatEuro(summary.paidCents) },
    { label: 'Sonderzahlungen', value: formatEuro(summary.bonusCents) },
    { label: 'Kürzungen', value: formatEuro(summary.reductionCents) },
  ];

  return (
    <section>
      <PageHeader
        title="Meine Provision"
        description="Nur eigene Daten – keine Bearbeitung"
      />
      <div className={styles.metricsGrid}>
        {metrics.map((metric) => (
          <article key={metric.label} className={styles.metricCard}>
            <h2>{metric.label}</h2>
            <p>{metric.value}</p>
          </article>
        ))}
      </div>
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Summen</h2>
        <ul className={styles.summaryList}>
          <li>Monat: {formatEuro(summary.monthCents)}</li>
          <li>Jahr: {formatEuro(summary.yearCents)}</li>
          <li>Gesamt: {formatEuro(summary.totalCents)}</li>
        </ul>
      </section>
    </section>
  );
}
