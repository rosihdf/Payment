import { useCallback, useEffect, useState } from 'react';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { EmptyState } from '../../components/feedback/EmptyState';
import type { ActivationListItem, ActivationMetrics } from '../../domain/activation/activationCase';
import type { ActivationStatus } from '../../domain/activation/activationStatus';
import { hasPermission } from '../../domain/permission/permission';
import {
  getActivationDisplayGroup,
  getActivationDisplayLabel,
} from '../../features/activation/activationStatusDisplay';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { createUserContext } from '../../services/auditService';
import { formatDate } from '../../utils/format';
import { DataList, DataListCard } from '../ui/DataList';
import { FormField } from '../ui/FormField';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge, type StatusBadgeVariant } from '../ui/StatusBadge';
import styles from './ActivationsPage.module.css';

function activationStatusVariant(status: ActivationStatus): StatusBadgeVariant {
  switch (getActivationDisplayGroup(status)) {
    case 'blocked':
      return 'danger';
    case 'live':
      return 'success';
    case 'closed':
      return 'neutral';
    case 'go_live':
      return 'info';
    default:
      return 'warning';
  }
}

export function ActivationsPage() {
  const { currentUser } = useCurrentUser();
  const { activationService } = useServices();
  const [items, setItems] = useState<ActivationListItem[]>([]);
  const [metrics, setMetrics] = useState<ActivationMetrics | null>(null);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const canView =
    currentUser &&
    (hasPermission(currentUser.role, 'activations.view_own') ||
      hasPermission(currentUser.role, 'activations.view_team'));

  const load = useCallback(async () => {
    if (!currentUser || !canView) {
      return;
    }
    setIsLoading(true);
    const context = createUserContext({
      id: currentUser.id,
      role: currentUser.role,
      name: currentUser.name,
      status: currentUser.status,
    });
    const [listResult, metricsResult] = await Promise.all([
      activationService.list(context, { query, status: 'open_group', sortBy: 'nextDueAt' }),
      activationService.getMetrics(context),
    ]);
    if (listResult.ok) {
      setItems(listResult.value);
    }
    if (metricsResult.ok) {
      setMetrics(metricsResult.value);
    }
    setIsLoading(false);
  }, [activationService, canView, currentUser, query]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!currentUser) {
    return null;
  }

  if (!canView) {
    return <AccessDenied title="Kein Zugriff auf Aktivierungen" />;
  }

  return (
    <section>
      <PageHeader
        title="Onboarding"
        description="Inbetriebnahme zum Kunden – Einstieg bevorzugt über die Kundenakte"
      />

      {metrics ? (
        <div className={styles.metrics} aria-label="Aktivierungskennzahlen">
          <div className={styles.metricCard}>
            <span className={styles.metricValue}>{metrics.openCount}</span>
            <span className={styles.metricLabel}>Offen</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricValue}>{metrics.blockedCount}</span>
            <span className={styles.metricLabel}>Blockiert</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricValue}>{metrics.goLiveIn7Days}</span>
            <span className={styles.metricLabel}>Go-live in 7 Tagen</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricValue}>{metrics.goLiveReadyCount}</span>
            <span className={styles.metricLabel}>Go-live bereit</span>
          </div>
        </div>
      ) : null}

      <div className={styles.search}>
        <FormField
          type="search"
          label="Suche"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nummer, Vertrag, Firma, Kontakt, Angebot…"
        />
      </div>

      {isLoading ? (
        <EmptyState title="Aktivierungen werden geladen" description="Die Onboarding-Liste wird vorbereitet." />
      ) : items.length === 0 ? (
        <EmptyState
          title={query.trim() ? 'Keine Treffer' : 'Keine Aktivierungen'}
          description={
            query.trim()
              ? 'Keine Aktivierung entspricht der aktuellen Suche.'
              : 'Aktivierungen entstehen aus Verträgen in Vorbereitung oder Aktivierung.'
          }
        />
      ) : (
        <DataList
          items={items}
          getKey={(activation) => activation.id}
          aria-label="Aktivierungsliste"
          renderItem={(activation) => (
            <DataListCard
              href={`/activations/${activation.id}`}
              title={
                <>
                  {activation.customerCompanyName || 'Unbekannter Kunde'}
                  <span aria-hidden="true"> · </span>
                  {activation.activationNumber}
                </>
              }
              badge={
                <StatusBadge
                  variant={activationStatusVariant(activation.status)}
                  label={getActivationDisplayLabel(activation.status)}
                />
              }
              meta={
                <>
                  <span>Vertrag {activation.contractNumber}</span>
                  <span>{activation.contactName || 'Kein Kontakt'}</span>
                  <span>Angebot {activation.offerNumber}</span>
                  {activation.nextDueAt ? (
                    <span>Nächste Fälligkeit: {formatDate(activation.nextDueAt)}</span>
                  ) : (
                    <span>Keine nächste Fälligkeit</span>
                  )}
                  {activation.openBlockerCount > 0 ? (
                    <span>{activation.openBlockerCount} Blocker offen</span>
                  ) : null}
                </>
              }
            />
          )}
        />
      )}
    </section>
  );
}
