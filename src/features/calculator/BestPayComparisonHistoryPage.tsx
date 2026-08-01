import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SearchField } from '../../components/common/SearchField';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { EmptyState } from '../../components/feedback/EmptyState';
import { AccessDenied } from '../../components/feedback/AccessDenied';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  DEFAULT_BESTPAY_COMPARISON_LIST_FILTERS,
  type BestPayComparisonListFilters,
  type BestPayComparisonSummary,
} from '../../domain/bestPayComparison/bestPayComparisonSummary';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import { formatDateTime } from '../../utils/format';
import styles from './BestPayComparisonHistoryPage.module.css';

type DialogMode = 'archive' | 'delete' | null;

function formatEuro(cents: number | null): string {
  if (cents === null) {
    return '—';
  }
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function statusLabel(summary: BestPayComparisonSummary): string {
  switch (summary.displayStatus) {
    case 'draft':
    case 'billing_import':
    case 'ready_for_calculation':
      return 'Entwurf';
    case 'review_required':
      return 'Prüfung erforderlich';
    case 'calculated':
      return 'Berechnet';
    case 'recommendation_selected':
    case 'assigned':
      return 'Variante gewählt';
    case 'offer_created':
      return 'Angebot erstellt';
    case 'archived':
      return 'Archiviert';
    default:
      return summary.status;
  }
}

function savingsLabel(summary: BestPayComparisonSummary): string {
  if (!summary.hasResult || summary.savingsMonthlyCents === null) {
    return 'Noch nicht berechnet';
  }
  if (summary.isHigherCost) {
    return `${formatEuro(Math.abs(summary.savingsMonthlyCents))} / Monat Mehrkosten`;
  }
  return `${formatEuro(summary.savingsMonthlyCents)} / Monat Ersparnis`;
}

function primaryActionLabel(summary: BestPayComparisonSummary): string {
  switch (summary.primaryAction) {
    case 'continue_editing':
      return 'Weiter bearbeiten';
    case 'review_data':
      return 'Daten prüfen';
    case 'open_result':
      return 'Ergebnis öffnen';
    case 'open_offer':
      return 'Angebot öffnen';
    case 'recalculate':
      return 'Neu berechnen';
    case 'restore':
      return 'Wiederherstellen';
    default:
      return 'Öffnen';
  }
}

export function BestPayComparisonHistoryPage() {
  const { currentUser } = useCurrentUser();
  const { bestPayComparisonService } = useServices();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<BestPayComparisonListFilters>(DEFAULT_BESTPAY_COMPARISON_LIST_FILTERS);
  const [items, setItems] = useState<BestPayComparisonSummary[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [dialogTarget, setDialogTarget] = useState<BestPayComparisonSummary | null>(null);
  const [actionInFlight, setActionInFlight] = useState(false);

  const userContext = useMemo(
    () =>
      currentUser
        ? { userId: currentUser.id, role: currentUser.role, displayName: currentUser.name }
        : null,
    [currentUser],
  );

  const reload = useCallback(() => {
    if (!userContext) {
      return;
    }
    if (!bestPayComparisonService.canAccessHistory(userContext)) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    const list = bestPayComparisonService.listComparisons(userContext, filters);
    setItems(list ?? []);
    setArchivedCount(bestPayComparisonService.countArchived(userContext));
    setIsLoading(false);
  }, [bestPayComparisonService, filters, userContext]);

  useEffect(() => {
    setIsLoading(true);
    reload();
  }, [reload]);

  if (!currentUser || !userContext) {
    return <EmptyState title="Kein Benutzer" description="Bitte melden Sie sich an." />;
  }

  if (!bestPayComparisonService.canAccessHistory(userContext)) {
    return <AccessDenied />;
  }

  const updateFilter = <K extends keyof BestPayComparisonListFilters>(
    key: K,
    value: BestPayComparisonListFilters[K],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handlePrimary = (summary: BestPayComparisonSummary) => {
    if (summary.primaryAction === 'restore') {
      const result = bestPayComparisonService.restoreComparison(summary.id, userContext);
      if (!result.ok) {
        showToast('Wiederherstellung fehlgeschlagen', 'error');
        return;
      }
      showToast('Berechnung wiederhergestellt', 'success');
      reload();
      return;
    }
    if (summary.primaryAction === 'open_offer' && summary.offerId) {
      navigate(`/offers/${summary.offerId}`);
      return;
    }
    const resumed = bestPayComparisonService.resumeComparison(summary.id, userContext);
    if (!resumed.ok) {
      showToast('Berechnung konnte nicht geöffnet werden', 'error');
      return;
    }
    navigate(`/calculator/bestpay?session=${summary.id}`);
  };

  const handleDuplicate = (summary: BestPayComparisonSummary) => {
    if (actionInFlight) {
      return;
    }
    setActionInFlight(true);
    const result = bestPayComparisonService.duplicateComparison(summary.id, userContext);
    setActionInFlight(false);
    setOpenMenuId(null);
    if (!result.ok) {
      showToast(result.message ?? 'Duplizieren fehlgeschlagen', 'error');
      return;
    }
    showToast('Berechnung dupliziert', 'success');
    navigate(`/calculator/bestpay?session=${result.session.id}`);
  };

  const confirmDialog = () => {
    if (!dialogTarget || actionInFlight) {
      return;
    }
    setActionInFlight(true);
    if (dialogMode === 'archive') {
      const result = bestPayComparisonService.archiveComparison(dialogTarget.id, userContext);
      setActionInFlight(false);
      setDialogMode(null);
      setDialogTarget(null);
      if (!result.ok) {
        showToast('Archivierung fehlgeschlagen', 'error');
        return;
      }
      showToast('Berechnung archiviert', 'success');
      reload();
      return;
    }
    if (dialogMode === 'delete') {
      const result = bestPayComparisonService.deleteDraftComparison(dialogTarget.id, userContext);
      setActionInFlight(false);
      setDialogMode(null);
      setDialogTarget(null);
      if (!result.ok) {
        showToast(result.message ?? 'Löschen nicht möglich', 'error');
        return;
      }
      showToast('Entwurf gelöscht', 'success');
      reload();
    }
  };

  const emptyBecauseFilters =
    !isLoading &&
    items.length === 0 &&
    (filters.query ||
      filters.status !== 'all' ||
      filters.freshness !== 'all' ||
      filters.assignment !== 'all' ||
      filters.source !== 'all' ||
      filters.timeRange !== 'all');

  return (
    <section>
      <PageHeader
        title="Gespeicherte BestPay-Berechnungen"
        subtitle="Entwürfe fortsetzen, abgeschlossene Vergleiche nachvollziehen und verknüpfte Angebote öffnen."
        actions={
          <div className={styles.actions}>
            <Link className={styles.secondaryAction} to="/advice">
              Zur Beratung
            </Link>
            <Link className={styles.primaryAction} to="/calculator/bestpay?new=1">
              Neuer Vergleich
            </Link>
          </div>
        }
      />

      <div className={styles.toolbar}>
        <div style={{ flex: '1 1 240px' }}>
          <SearchField
            value={filters.query}
            onChange={(value) => updateFilter('query', value)}
            placeholder="Berechnungen durchsuchen"
            label="Berechnungen durchsuchen"
          />
        </div>
        <div className={styles.filters}>
          <div className={styles.filterField}>
            <label htmlFor="statusFilter">Status</label>
            <select
              id="statusFilter"
              value={filters.status}
              onChange={(event) => {
                const status = event.target.value as BestPayComparisonListFilters['status'];
                setFilters((current) => ({
                  ...current,
                  status,
                  includeArchived: status === 'archived' ? true : current.includeArchived,
                }));
              }}
            >
              <option value="all">Alle</option>
              <option value="draft">Entwurf</option>
              <option value="review_required">Prüfung erforderlich</option>
              <option value="calculated">Berechnet</option>
              <option value="offer_created">Angebot erstellt</option>
              <option value="archived">Archiviert</option>
            </select>
          </div>
          <div className={styles.filterField}>
            <label htmlFor="freshnessFilter">Aktualität</label>
            <select
              id="freshnessFilter"
              value={filters.freshness}
              onChange={(event) =>
                updateFilter('freshness', event.target.value as BestPayComparisonListFilters['freshness'])
              }
            >
              <option value="all">Alle</option>
              <option value="current">Aktuell</option>
              <option value="stale">Veraltet</option>
            </select>
          </div>
          <div className={styles.filterField}>
            <label htmlFor="assignmentFilter">Zuordnung</label>
            <select
              id="assignmentFilter"
              value={filters.assignment}
              onChange={(event) =>
                updateFilter('assignment', event.target.value as BestPayComparisonListFilters['assignment'])
              }
            >
              <option value="all">Alle</option>
              <option value="with_lead">Mit Lead</option>
              <option value="without_lead">Ohne Lead</option>
              <option value="with_offer">Mit Angebot</option>
              <option value="without_offer">Ohne Angebot</option>
            </select>
          </div>
          <div className={styles.filterField}>
            <label htmlFor="sourceFilter">Datenquelle</label>
            <select
              id="sourceFilter"
              value={filters.source}
              onChange={(event) =>
                updateFilter('source', event.target.value as BestPayComparisonListFilters['source'])
              }
            >
              <option value="all">Alle</option>
              <option value="billing_import">Abrechnung</option>
              <option value="manual">Manuelle Eingabe</option>
              <option value="mixed">Gemischt</option>
            </select>
          </div>
          <div className={styles.filterField}>
            <label htmlFor="timeFilter">Zeitraum</label>
            <select
              id="timeFilter"
              value={filters.timeRange}
              onChange={(event) =>
                updateFilter('timeRange', event.target.value as BestPayComparisonListFilters['timeRange'])
              }
            >
              <option value="all">Alle</option>
              <option value="today">Heute</option>
              <option value="last_7_days">Letzte 7 Tage</option>
              <option value="last_30_days">Letzte 30 Tage</option>
            </select>
          </div>
          <div className={styles.filterField}>
            <label htmlFor="sortFilter">Sortierung</label>
            <select
              id="sortFilter"
              value={filters.sort}
              onChange={(event) =>
                updateFilter('sort', event.target.value as BestPayComparisonListFilters['sort'])
              }
            >
              <option value="updated_desc">Zuletzt geändert</option>
              <option value="updated_asc">Älteste Änderung zuerst</option>
              <option value="created_desc">Neueste Erstellung</option>
              <option value="title_asc">Händler/Titel A–Z</option>
              <option value="savings_desc">Höchste Ersparnis</option>
              <option value="extra_cost_desc">Höchste Mehrkosten</option>
            </select>
          </div>
          <button
            type="button"
            className={styles.secondaryAction}
            onClick={() => setFilters(DEFAULT_BESTPAY_COMPARISON_LIST_FILTERS)}
          >
            Filter zurücksetzen
          </button>
        </div>
      </div>

      {isLoading ? (
        <EmptyState title="Berechnungen werden geladen" description="Die Übersicht wird vorbereitet." />
      ) : items.length === 0 && !emptyBecauseFilters ? (
        <EmptyState
          title="Noch keine BestPay-Berechnungen"
          description="Erstelle eine neue Berechnung manuell oder lies eine Händlerabrechnung ein."
          action={
            <div className={styles.actions}>
              <Link className={styles.primaryAction} to="/calculator/bestpay?mode=billing&new=1">
                Abrechnung einlesen
              </Link>
              <Link className={styles.secondaryAction} to="/calculator/bestpay?mode=manual&new=1">
                Werte manuell eingeben
              </Link>
              {archivedCount > 0 ? (
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      status: 'archived',
                      includeArchived: true,
                    }))
                  }
                >
                  Archivierte anzeigen
                </button>
              ) : null}
            </div>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Keine passenden Berechnungen gefunden"
          description="Passen Sie Suche oder Filter an."
          action={
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => setFilters(DEFAULT_BESTPAY_COMPARISON_LIST_FILTERS)}
            >
              Suche und Filter zurücksetzen
            </button>
          }
        />
      ) : (
        <ul className={styles.list}>
          {items.map((summary) => (
            <li key={summary.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.title}>{summary.title}</h2>
                  <p className={styles.hint}>
                    {summary.leadLabel ?? summary.merchantLabel ?? 'Ohne Lead-Zuordnung'}
                  </p>
                </div>
                <div className={styles.badges}>
                  <span className={styles.badge}>{statusLabel(summary)}</span>
                  {summary.isStale ? <span className={styles.badgeStale}>Veraltet</span> : null}
                  {summary.archivedAt ? <span className={styles.badgeArchived}>Archiviert</span> : null}
                </div>
              </div>

              <div className={styles.meta}>
                <span>Aktualisiert: {formatDateTime(summary.updatedAt)}</span>
                <span>
                  Quelle:{' '}
                  {summary.source === 'billing_import'
                    ? 'Abrechnung'
                    : summary.source === 'manual'
                      ? 'Manuell'
                      : summary.source === 'mixed'
                        ? 'Gemischt'
                        : '—'}
                </span>
                <span>Variante: {summary.selectedVariantName ?? '—'}</span>
              </div>

              <div className={styles.metrics}>
                <strong>{savingsLabel(summary)}</strong>
                {summary.offerNumber ? <span>Angebot: {summary.offerNumber}</span> : null}
                {summary.isStale && summary.staleReasons[0] ? (
                  <span className={styles.hint}>{summary.staleReasons[0]}</span>
                ) : null}
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryAction}
                  onClick={() => handlePrimary(summary)}
                >
                  {primaryActionLabel(summary)}
                </button>
                {summary.leadId ? (
                  <Link className={styles.linkAction} to={`/leads/${summary.leadId}`}>
                    Lead öffnen
                  </Link>
                ) : null}
                {summary.offerId ? (
                  <Link className={styles.linkAction} to={`/offers/${summary.offerId}`}>
                    Angebot öffnen
                  </Link>
                ) : null}
                <div className={styles.menu}>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    aria-label={`Weitere Aktionen für ${summary.title}`}
                    aria-expanded={openMenuId === summary.id}
                    onClick={() => setOpenMenuId((current) => (current === summary.id ? null : summary.id))}
                  >
                    Mehr
                  </button>
                  {openMenuId === summary.id ? (
                    <div className={styles.menuPanel} role="menu">
                      {summary.canDuplicate ? (
                        <button type="button" role="menuitem" onClick={() => handleDuplicate(summary)}>
                          Berechnung duplizieren
                        </button>
                      ) : null}
                      {summary.canArchive ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setDialogTarget(summary);
                            setDialogMode('archive');
                            setOpenMenuId(null);
                          }}
                        >
                          Archivieren
                        </button>
                      ) : null}
                      {summary.canRestore ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            handlePrimary(summary);
                            setOpenMenuId(null);
                          }}
                        >
                          Wiederherstellen
                        </button>
                      ) : null}
                      {summary.canDelete ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setDialogTarget(summary);
                            setDialogMode('delete');
                            setOpenMenuId(null);
                          }}
                        >
                          Entwurf löschen
                        </button>
                      ) : null}
                      <Link role="menuitem" to={`/calculator/bestpay?session=${summary.id}`}>
                        Berechnung öffnen
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={dialogMode === 'archive' && Boolean(dialogTarget)}
        title="Berechnung archivieren"
        message={`„${dialogTarget?.title ?? ''}“ wird aus der Standardansicht entfernt. Verknüpfte Leads und Angebote bleiben unverändert.`}
        confirmLabel="Archivieren"
        cancelLabel="Abbrechen"
        onConfirm={confirmDialog}
        onCancel={() => {
          setDialogMode(null);
          setDialogTarget(null);
        }}
      />
      <ConfirmDialog
        isOpen={dialogMode === 'delete' && Boolean(dialogTarget)}
        title="Entwurf löschen"
        message={`„${dialogTarget?.title ?? ''}“ wird unwiderruflich gelöscht. Betroffen ist nur der lokale Rechnerentwurf.`}
        confirmLabel="Endgültig löschen"
        cancelLabel="Abbrechen"
        onConfirm={confirmDialog}
        onCancel={() => {
          setDialogMode(null);
          setDialogTarget(null);
        }}
      />
    </section>
  );
}
