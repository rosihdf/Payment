import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { SearchField } from '../../components/common/SearchField';
import { PageHeader } from '../../components/layout/PageHeader';
import type { ActivationListItem, ActivationMetrics } from '../../domain/activation/activationCase';
import { ACTIVATION_PRIORITY_LABELS } from '../../domain/activation/activationCase';
import {
  ACTIVATION_GO_LIVE_WINDOW_LABELS,
  ACTIVATION_SORT_LABELS,
  ACTIVATION_WORK_STATE_LABELS,
  listActivationPriorityFilterOptions,
  listActivationStatusFilterOptions,
  type ActivationGoLiveWindowFilter,
  type ActivationSortBy,
  type ActivationWorkStateFilter,
} from '../../domain/activation/activationOverview';
import { ACTIVATION_STATUS_LABELS, type ActivationStatus } from '../../domain/activation/activationStatus';
import { hasPermission } from '../../domain/permission/permission';
import type { User } from '../../domain/user/user';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import type { ActivationFilters } from '../../services/activationService';
import { ActivationStatusBadge } from './ActivationStatusBadge';
import styles from './ActivationsPage.module.css';

function toUserContext(user: {
  id: string;
  role: import('../../domain/user/user').UserRole;
  name: string;
  status: import('../../domain/user/user').UserStatus;
}) {
  return {
    userId: user.id,
    role: user.role,
    displayName: user.name,
    status: user.status,
  };
}

const DEFAULT_STATUS: NonNullable<ActivationFilters['status']> = 'open_group';
const DEFAULT_SORT: ActivationSortBy = 'nextDueAt';

export function ActivationsPage() {
  const { currentUser } = useCurrentUser();
  const { activationService, userService } = useServices();
  const [items, setItems] = useState<ActivationListItem[]>([]);
  const [metrics, setMetrics] = useState<ActivationMetrics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<NonNullable<ActivationFilters['status']>>(DEFAULT_STATUS);
  const [priority, setPriority] = useState<NonNullable<ActivationFilters['priority']>>('all');
  const [ownerFilter, setOwnerFilter] = useState<NonNullable<ActivationFilters['ownerUserId']>>('all');
  const [goLiveWindow, setGoLiveWindow] = useState<ActivationGoLiveWindowFilter>('all');
  const [workState, setWorkState] = useState<ActivationWorkStateFilter>('all');
  const [sortBy, setSortBy] = useState<ActivationSortBy>(DEFAULT_SORT);

  const canView =
    currentUser &&
    (hasPermission(currentUser.role, 'activations.view_own') ||
      hasPermission(currentUser.role, 'activations.view_team'));
  const canViewTeam = currentUser ? hasPermission(currentUser.role, 'activations.view_team') : false;

  const load = useCallback(async () => {
    if (!currentUser || !canView) return;
    const context = toUserContext(currentUser);
    const [listResult, metricsResult, allUsers] = await Promise.all([
      activationService.list(context, {
        query,
        status,
        priority,
        ownerUserId: ownerFilter,
        goLiveWindow,
        workState,
        sortBy,
      }),
      activationService.getMetrics(context),
      userService.getAllUsers(),
    ]);
    if (listResult.ok) setItems(listResult.value);
    if (metricsResult.ok) setMetrics(metricsResult.value);
    setUsers(allUsers.filter((user) => user.status === 'active'));
  }, [
    activationService,
    canView,
    currentUser,
    goLiveWindow,
    ownerFilter,
    priority,
    query,
    sortBy,
    status,
    userService,
    workState,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (query.trim()) chips.push(`Suche: ${query.trim()}`);
    if (status !== 'all') {
      chips.push(
        status === 'open_group'
          ? 'Status: Offen'
          : status === 'blocked_group'
            ? 'Status: Blockiert'
            : `Status: ${ACTIVATION_STATUS_LABELS[status as ActivationStatus]}`,
      );
    }
    if (priority !== 'all') chips.push(`Priorität: ${ACTIVATION_PRIORITY_LABELS[priority]}`);
    if (ownerFilter === 'mine') chips.push('Zuständigkeit: Eigene');
    else if (ownerFilter === 'unassigned') chips.push('Zuständigkeit: Ohne Verantwortlichen');
    else if (ownerFilter !== 'all') {
      const owner = users.find((user) => user.id === ownerFilter);
      chips.push(`Zuständigkeit: ${owner?.name ?? ownerFilter}`);
    }
    if (goLiveWindow !== 'all') chips.push(ACTIVATION_GO_LIVE_WINDOW_LABELS[goLiveWindow]);
    if (workState !== 'all') chips.push(ACTIVATION_WORK_STATE_LABELS[workState]);
    if (sortBy !== DEFAULT_SORT) chips.push(`Sortierung: ${ACTIVATION_SORT_LABELS[sortBy]}`);
    return chips;
  }, [goLiveWindow, ownerFilter, priority, query, sortBy, status, users, workState]);

  const hasActiveFilters =
    Boolean(query.trim()) ||
    status !== DEFAULT_STATUS ||
    priority !== 'all' ||
    ownerFilter !== 'all' ||
    goLiveWindow !== 'all' ||
    workState !== 'all';

  const resetFilters = () => {
    setQuery('');
    setStatus(DEFAULT_STATUS);
    setPriority('all');
    setOwnerFilter('all');
    setGoLiveWindow('all');
    setWorkState('all');
    setSortBy(DEFAULT_SORT);
  };

  if (!currentUser) return null;
  if (!canView) {
    return <AccessDenied title="Kein Zugriff auf Aktivierungen" />;
  }

  const emptyTitle = !hasActiveFilters && items.length === 0 ? 'Keine Aktivierungen' : 'Keine Treffer';
  const emptyDescription = !hasActiveFilters
    ? 'Aktivierungen entstehen aus Verträgen in Vorbereitung oder Aktivierung.'
    : query.trim() && items.length === 0
      ? 'Keine Aktivierung entspricht der aktuellen Suche.'
      : 'Keine Aktivierung entspricht den aktuellen Filtern.';

  return (
    <section>
      <PageHeader
        title="Onboarding"
        subtitle="Inbetriebnahme zum Kunden – Einstieg bevorzugt über die Kundenakte"
      />

      {metrics ? (
        <div className={styles.metrics} aria-label="Aktivierungskennzahlen">
          {[
            ['Offen', metrics.openCount],
            ['Blockiert', metrics.blockedCount],
            ['Go-live in 7 Tagen', metrics.goLiveIn7Days],
            ['Unterlagen offen', metrics.documentsOpenCount],
            ['Anbieterprüfung', metrics.providerReviewCount],
            ['Hardware offen', metrics.hardwareOpenCount],
            ['Einrichtung offen', metrics.setupOpenCount],
            ['Test offen', metrics.testOpenCount],
            ['Go-live bereit', metrics.goLiveReadyCount],
            ['Abschluss offen', metrics.completionOpenCount],
            ['Ohne nächste Aufgabe', metrics.withoutNextTaskCount],
          ].map(([label, value]) => (
            <div key={String(label)} className={styles.metricCard}>
              <span className={styles.metricValue}>{value}</span>
              <span className={styles.metricLabel}>{label}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Nummer, Vertrag, Firma, Kontakt, Angebot, Referenz, Seriennummer, Modell"
        />

        <div className={styles.filters} role="group" aria-label="Schnellfilter Status">
          {(
            [
              ['open_group', 'Offen'],
              ['blocked_group', 'Blockiert'],
              ['go_live_ready', 'Go-live bereit'],
              ['live', 'Abschluss offen'],
              ['completed', 'Abgeschlossen'],
              ['all', 'Alle'],
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

        <div className={styles.secondaryFilters}>
          <label>
            Status
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as NonNullable<ActivationFilters['status']>)
              }
            >
              <option value="open_group">Offene Vorgänge</option>
              <option value="blocked_group">Blockiert (Gruppe)</option>
              {listActivationStatusFilterOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Priorität
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as NonNullable<ActivationFilters['priority']>)
              }
            >
              {listActivationPriorityFilterOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Zuständigkeit
            <select
              value={ownerFilter}
              onChange={(event) =>
                setOwnerFilter(event.target.value as NonNullable<ActivationFilters['ownerUserId']>)
              }
            >
              <option value="all">Alle</option>
              <option value="mine">Eigene</option>
              <option value="unassigned">Ohne Verantwortlichen</option>
              {canViewTeam
                ? users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))
                : null}
            </select>
          </label>

          <label>
            Go-live-Zeitraum
            <select
              value={goLiveWindow}
              onChange={(event) =>
                setGoLiveWindow(event.target.value as ActivationGoLiveWindowFilter)
              }
            >
              <option value="all">Alle</option>
              {(Object.entries(ACTIVATION_GO_LIVE_WINDOW_LABELS) as Array<
                [Exclude<ActivationGoLiveWindowFilter, 'all'>, string]
              >).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Arbeitszustand
            <select
              value={workState}
              onChange={(event) => setWorkState(event.target.value as ActivationWorkStateFilter)}
            >
              <option value="all">Alle</option>
              {(Object.entries(ACTIVATION_WORK_STATE_LABELS) as Array<
                [Exclude<ActivationWorkStateFilter, 'all'>, string]
              >).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Sortierung
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as ActivationSortBy)}
            >
              {(Object.entries(ACTIVATION_SORT_LABELS) as Array<[ActivationSortBy, string]>).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>

        <div className={styles.filterMeta}>
          <p className={styles.resultCount} aria-live="polite">
            {items.length} Ergebnis{items.length === 1 ? '' : 'se'}
          </p>
          {activeFilterChips.length > 0 ? (
            <ul className={styles.activeFilters} aria-label="Aktive Filter">
              {activeFilterChips.map((chip) => (
                <li key={chip}>{chip}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className={styles.resetButton}
            onClick={resetFilters}
            disabled={!hasActiveFilters && sortBy === DEFAULT_SORT}
            aria-label="Filter und Suche zurücksetzen"
          >
            Filter zurücksetzen
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className={styles.list}>
          {items.map((activation) => (
            <li key={activation.id}>
              <Link className={styles.card} to={`/activations/${activation.id}`}>
                <div className={styles.cardHeader}>
                  <strong>
                    {activation.activationNumber} · {activation.customerCompanyName}
                  </strong>
                  <ActivationStatusBadge status={activation.status} />
                </div>
                <div className={styles.cardMeta}>
                  <span>Vertrag: {activation.contractNumber}</span>
                  <span>Priorität: {ACTIVATION_PRIORITY_LABELS[activation.priority]}</span>
                  <span>Fortschritt: {activation.progressPercent}%</span>
                  <span>Nächster Schritt: {activation.nextStep ?? '–'}</span>
                  <span>
                    Gewünschter Go-live:{' '}
                    {activation.desiredGoLive ? activation.desiredGoLive.slice(0, 10) : '–'}
                  </span>
                  <span>
                    Nächste Frist:{' '}
                    {activation.nextDueAt ? activation.nextDueAt.slice(0, 10) : '–'}
                  </span>
                  <span>Offene Blocker: {activation.openBlockerCount}</span>
                  <span>Nächste Aufgabe: {activation.hasOpenTask ? 'vorhanden' : 'keine'}</span>
                </div>
                {activation.warningLabels.length > 0 ? (
                  <div className={styles.warnings}>
                    {activation.warningLabels.map((warning) => (
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
