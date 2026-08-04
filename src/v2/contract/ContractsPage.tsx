import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { EmptyState } from '../../components/feedback/EmptyState';
import type { ContractListItem, ContractMetrics } from '../../domain/contract/contract';
import type { ContractStatus } from '../../domain/contract/contractStatus';
import { CONTRACT_STATUS_LABELS } from '../../domain/contract/contractStatus';
import { getContractDisplayGroup, getContractDisplayLabel } from '../../features/contract/contractStatusDisplay';
import { hasPermission } from '../../domain/permission/permission';
import type { UserRole, UserStatus } from '../../domain/user/user';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { Button } from '../ui/Button';
import { DataList, DataListCard } from '../ui/DataList';
import { FormField } from '../ui/FormField';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge, type StatusBadgeVariant } from '../ui/StatusBadge';
import styles from './ContractsPage.module.css';

function toUserContext(user: { id: string; role: UserRole; name: string; status: UserStatus }) {
  return {
    userId: user.id,
    role: user.role,
    displayName: user.name,
    status: user.status,
  };
}

function contractStatusVariant(status: ContractStatus): StatusBadgeVariant {
  switch (getContractDisplayGroup(status)) {
    case 'preparation':
      return 'info';
    case 'activation':
      return 'warning';
    case 'active':
      return 'success';
    case 'change_or_termination':
      return 'warning';
    case 'ended':
    case 'archived':
      return 'neutral';
    default:
      return 'neutral';
  }
}

const STATUS_OPTIONS: Array<{
  value: 'all' | 'active_group' | 'activation_group' | 'expiring' | 'termination' | 'ended_group';
  label: string;
}> = [
  { value: 'all', label: 'Alle' },
  { value: 'active_group', label: 'Aktiv' },
  { value: 'activation_group', label: 'Aktivierung' },
  { value: 'expiring', label: 'Auslaufend' },
  { value: 'termination', label: 'Kündigung' },
  { value: 'ended_group', label: 'Beendet' },
];

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
        description="Vertragsbeziehung zum Kunden – Einstieg bevorzugt über die Kundenakte"
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

      <div className={styles.search}>
        <FormField
          type="search"
          label="Suche"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Vertragsnummer, Firma, Tarif, Angebot suchen"
        />
      </div>

      <div className={styles.filters} role="group" aria-label="Statusfilter">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.filterButton} ${status === option.value ? styles.filterButtonActive : ''}`}
            aria-pressed={status === option.value}
            onClick={() => setStatus(option.value)}
          >
            {option.label}
          </button>
        ))}
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
                    <Button size="compact" variant="secondary" onClick={() => void createMissing(entry.offerId)}>
                      Vertrag anlegen
                    </Button>
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
        <DataList
          items={items}
          getKey={(contract) => contract.id}
          aria-label="Vertragsliste"
          renderItem={(contract) => (
            <DataListCard
              href={`/contracts/${contract.id}`}
              title={
                <>
                  {contract.contractNumber} · {contract.customerCompanyName}
                </>
              }
              badge={
                <StatusBadge
                  variant={contractStatusVariant(contract.status)}
                  label={getContractDisplayLabel(contract.status)}
                  technicalLabel={CONTRACT_STATUS_LABELS[contract.status]}
                />
              }
              meta={
                <>
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
                </>
              }
              footer={
                contract.warningLabels.length > 0 ? (
                  <div className={styles.warnings}>
                    {contract.warningLabels.map((warning) => (
                      <span key={warning} className={styles.warning}>
                        {warning}
                      </span>
                    ))}
                  </div>
                ) : undefined
              }
            />
          )}
        />
      )}
    </section>
  );
}
