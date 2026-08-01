import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { FormControl } from '../../components/common/FormControl';
import { PageHeader } from '../../components/layout/PageHeader';
import type { ContractListItem, ContractMetrics } from '../../domain/contract/contract';
import { CONTRACT_STATUS_LABELS } from '../../domain/contract/contractStatus';
import { hasPermission } from '../../domain/permission/permission';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { ContractStatusBadge } from './ContractStatusBadge';
import styles from './ContractsPage.module.css';

function toUserContext(user: { id: string; role: import('../../domain/user/user').UserRole; name: string; status: import('../../domain/user/user').UserStatus }) {
  return {
    userId: user.id,
    role: user.role,
    displayName: user.name,
    status: user.status,
  };
}

export function ContractsPage() {
  const { currentUser } = useCurrentUser();
  const { contractService } = useServices();
  const [items, setItems] = useState<ContractListItem[]>([]);
  const [metrics, setMetrics] = useState<ContractMetrics | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<
    'all' | 'active_group' | 'activation_group' | 'expiring' | 'termination' | 'ended_group'
  >('all');
  const [message, setMessage] = useState<string | null>(null);
  const [acceptedWithout, setAcceptedWithout] = useState<
    Array<{ offerId: string; offerNumber: string; workflowStatus: string }>
  >([]);

  const canView =
    currentUser &&
    (hasPermission(currentUser.role, 'contracts.view_own') ||
      hasPermission(currentUser.role, 'contracts.view_team'));

  const load = useCallback(async () => {
    if (!currentUser || !canView) return;
    const context = toUserContext(currentUser);
    const [listResult, metricsResult, missing] = await Promise.all([
      contractService.list(context, { query, status, sortBy: 'deadline' }),
      contractService.getMetrics(context),
      contractService.findAcceptedOffersWithoutContract(context),
    ]);
    if (listResult.ok) setItems(listResult.value);
    if (metricsResult.ok) setMetrics(metricsResult.value);
    setAcceptedWithout(missing);
  }, [canView, contractService, currentUser, query, status]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!currentUser) return null;
  if (!canView) {
    return <AccessDenied title="Kein Zugriff auf Verträge" />;
  }

  const createMissing = async (offerId: string) => {
    const result = await contractService.createFromAcceptedOffer(offerId, toUserContext(currentUser));
    if (result.ok) {
      setMessage(`Vertrag ${result.value.contractNumber} angelegt`);
      await load();
    } else {
      setMessage(result.message ?? result.error);
    }
  };

  return (
    <section>
      <PageHeader
        title="Verträge"
        subtitle="Vertragsbeziehung zum Kunden – Einstieg bevorzugt über die Kundenakte"
      />

      {metrics ? (
        <div className={styles.metrics} aria-label="Vertragskennzahlen">
          {[
            ['Aktiv', metrics.activeCount],
            ['Aktivierung', metrics.activationCount],
            ['Auslaufend 90 Tage', metrics.expiringIn90Days],
            ['Kündigungen offen', metrics.openTerminations],
            ['Geplante Änderungen', metrics.plannedChanges],
            ['Verlängerungen fällig', metrics.renewalsDue],
            ['Gesperrt', metrics.suspendedCount],
            ['Ohne nächste Aufgabe', metrics.withoutNextTask],
            ['Angebote ohne Vertrag', metrics.acceptedOffersWithoutContract],
          ].map(([label, value]) => (
            <div key={String(label)} className={styles.metricCard}>
              <span className={styles.metricValue}>{value}</span>
              <span className={styles.metricLabel}>{label}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <FormControl
          type="search"
          label="Suche"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Vertragsnummer, Firma, Tarif, Angebot suchen"
        />
        <div className={styles.filters} role="group" aria-label="Statusfilter">
          {(
            [
              ['all', 'Alle'],
              ['active_group', 'Aktiv'],
              ['activation_group', 'Aktivierung'],
              ['expiring', 'Auslaufend'],
              ['termination', 'Kündigung'],
              ['ended_group', 'Beendet'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`${styles.filterButton} ${status === value ? styles.filterButtonActive : ''}`}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {message ? <p role="status">{message}</p> : null}

      {acceptedWithout.length > 0 ? (
        <EmptyState
          title="Angenommene Angebote ohne Vertrag"
          description={`${acceptedWithout.length} Angebot(e) können kontrolliert als Vertrag angelegt werden.`}
          action={
            <ul>
              {acceptedWithout.slice(0, 5).map((entry) => (
                <li key={entry.offerId}>
                  <Link to={`/offers/${entry.offerId}`}>{entry.offerNumber}</Link>{' '}
                  {hasPermission(currentUser.role, 'contracts.create') ? (
                    <button type="button" onClick={() => void createMissing(entry.offerId)}>
                      Vertrag anlegen
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          }
        />
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="Keine Verträge"
          description={
            query || status !== 'all'
              ? 'Keine Treffer für die aktuelle Suche oder Filter.'
              : 'Verträge entstehen aus angenommenen Angeboten.'
          }
        />
      ) : (
        <ul className={styles.list}>
          {items.map((contract) => (
            <li key={contract.id}>
              <Link className={styles.card} to={`/contracts/${contract.id}`}>
                <div className={styles.cardHeader}>
                  <strong>
                    {contract.contractNumber} · {contract.customerCompanyName}
                  </strong>
                  <ContractStatusBadge status={contract.status} />
                </div>
                <div className={styles.cardMeta}>
                  <span>Tarif: {contract.tariffName ?? '–'}</span>
                  <span>
                    Laufzeit: {contract.startDate ?? '–'} bis {contract.endDate ?? '–'}
                  </span>
                  <span>
                    Nächste Frist: {contract.nextDeadlineLabel ?? '–'}{' '}
                    {contract.nextDeadlineAt ? `(${contract.nextDeadlineAt})` : ''}
                  </span>
                  <span>Hardware: {contract.hardwareCount}</span>
                  <span>Nächste Aufgabe: {contract.nextTaskTitle ?? '–'}</span>
                  <span>Status: {CONTRACT_STATUS_LABELS[contract.status]}</span>
                </div>
                {contract.warningLabels.length > 0 ? (
                  <div className={styles.warnings}>
                    {contract.warningLabels.map((warning) => (
                      <span key={warning} className={styles.warning}>
                        {warning}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
