import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import type { Tariff, TariffStatusFilter, TerminalTypeFilter } from '../../domain/tariff/tariff';
import {
  monthlyFixedCostsForOneTerminalCents,
  TERMINAL_TYPE_LABELS,
  TARIFF_STATUS_LABELS,
} from '../../domain/tariff/tariff';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import { formatCentsToCurrency } from '../../utils/currency';
import {
  formatCardRate,
  formatGirocardClearing,
  formatOptionalMonths,
  formatValidityRange,
} from '../../utils/formatTariff';
import { formatTenthsOfCentToCurrency } from '../../utils/tenthsOfCent';
import { AdminLayout } from '../admin/AdminLayout';
import { formatTerminalTypes } from '../../utils/formatTerminalTypes';
import { Button } from '../../v2/ui/Button';
import { DataList, DataListCard } from '../../v2/ui/DataList';
import { Dialog } from '../../v2/ui/Dialog';
import { FormField } from '../../v2/ui/FormField';
import { StatusBadge } from '../../v2/ui/StatusBadge';
import styles from './AdminTariffsPage.module.css';

const STATUS_FILTER_OPTIONS: Array<{ value: TariffStatusFilter; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'active', label: TARIFF_STATUS_LABELS.active },
  { value: 'inactive', label: TARIFF_STATUS_LABELS.inactive },
];

const TERMINAL_FILTER_OPTIONS: Array<{ value: TerminalTypeFilter; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'stationary', label: TERMINAL_TYPE_LABELS.stationary },
  { value: 'mobile', label: TERMINAL_TYPE_LABELS.mobile },
  { value: 'softpos', label: TERMINAL_TYPE_LABELS.softpos },
  { value: 'ecommerce', label: TERMINAL_TYPE_LABELS.ecommerce },
];

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface AdminTariffsPageProps {
  /** In den zentralen Katalog eingebettet (ohne eigene Seitenhülle). */
  embedded?: boolean;
}

export function AdminTariffsPage({ embedded = false }: AdminTariffsPageProps) {
  const { currentUser } = useCurrentUser();
  const { tariffService } = useServices();
  const { showToast } = useToast();

  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TariffStatusFilter>('all');
  const [terminalFilter, setTerminalFilter] = useState<TerminalTypeFilter>('all');
  const [deactivateTarget, setDeactivateTarget] = useState<Tariff | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const loadTariffs = useCallback(async () => {
    const result = await tariffService.filterTariffs({
      query,
      status: statusFilter,
      terminalType: terminalFilter,
    });
    setTariffs(result);
    setIsLoading(false);
  }, [query, statusFilter, terminalFilter, tariffService]);

  useEffect(() => {
    setIsLoading(true);
    void loadTariffs();
  }, [loadTariffs]);

  const handleStatusToggle = (tariff: Tariff) => {
    if (!currentUser || statusUpdatingId) {
      return;
    }

    if (tariff.status === 'active') {
      setDeactivateTarget(tariff);
      return;
    }

    void (async () => {
      setStatusUpdatingId(tariff.id);
      const result = await tariffService.setTariffStatus(tariff.id, 'active', {
        role: currentUser.role,
      });

      if (result.ok) {
        showToast('Tarif wurde aktiviert', 'success');
        await loadTariffs();
      } else {
        showToast('Status konnte nicht geändert werden', 'error');
      }

      setStatusUpdatingId(null);
    })();
  };

  const handleDeactivateConfirmed = () => {
    if (!currentUser || !deactivateTarget) {
      return;
    }

    void (async () => {
      setStatusUpdatingId(deactivateTarget.id);
      const result = await tariffService.setTariffStatus(deactivateTarget.id, 'inactive', {
        role: currentUser.role,
      });

      if (result.ok) {
        showToast('Tarif wurde deaktiviert', 'success');
        await loadTariffs();
      } else {
        showToast('Status konnte nicht geändert werden', 'error');
      }

      setDeactivateTarget(null);
      setStatusUpdatingId(null);
    })();
  };

  const createAction = (
    <Link to="/admin/tariffs/new">
      <Button>Tarif anlegen</Button>
    </Link>
  );

  const content = (
    <>
      {embedded ? <div className={styles.embeddedActions}>{createAction}</div> : null}
      <div className={styles.toolbar}>
        <FormField
          type="search"
          label="Suche"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tarifname, Produktcode, Anbieter…"
        />

        <div className={styles.filters}>
          <fieldset className={styles.filterGroup}>
            <legend className={styles.filterLegend}>Status</legend>
            <div className={styles.filterOptions}>
              {STATUS_FILTER_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="compact"
                  variant={statusFilter === option.value ? 'primary' : 'secondary'}
                  aria-pressed={statusFilter === option.value}
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.filterGroup}>
            <legend className={styles.filterLegend}>Einsatzart</legend>
            <div className={styles.filterOptions}>
              {TERMINAL_FILTER_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="compact"
                  variant={terminalFilter === option.value ? 'primary' : 'secondary'}
                  aria-pressed={terminalFilter === option.value}
                  onClick={() => setTerminalFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      {isLoading ? (
        <EmptyState
          title="Tarife werden geladen"
          description="Die Tarifliste wird vorbereitet."
        />
      ) : tariffs.length === 0 ? (
        <EmptyState
          title="Keine Tarife gefunden"
          description="Für die aktuelle Suche oder Filterkombination liegen keine Tarife vor."
          action={createAction}
        />
      ) : (
        <DataList
          items={tariffs}
          getKey={(tariff) => tariff.id}
          aria-label="Tarifliste"
          renderItem={(tariff) => (
            <DataListCard
              title={tariff.name}
              badge={<StatusBadge variant={tariff.status === 'active' ? 'success' : 'neutral'} label={TARIFF_STATUS_LABELS[tariff.status]} />}
              meta={
                <>
                  <p className={styles.productCode}>{tariff.productCode} (intern)</p>
                  <dl className={styles.details}>
                    <div className={styles.detailRow}>
                      <dt>Einsatzarten</dt>
                      <dd>{formatTerminalTypes(tariff.supportedTerminalTypes)}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Grundgebühr je Vertrag</dt>
                      <dd>{formatCentsToCurrency(tariff.monthlyAccountBaseFeeCents)}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Terminalmiete je Terminal</dt>
                      <dd>{formatCentsToCurrency(tariff.monthlyTerminalRentalCents)}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Servicepauschale je Terminal</dt>
                      <dd>{formatCentsToCurrency(tariff.monthlyServiceFeePerTerminalCents)}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Fixkosten bei 1 Terminal</dt>
                      <dd>{formatCentsToCurrency(monthlyFixedCostsForOneTerminalCents(tariff))}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Transaktionspreis</dt>
                      <dd>{formatTenthsOfCentToCurrency(tariff.additionalTransactionFeeTenthsOfCent)}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Girocard-Clearing</dt>
                      <dd>
                        {formatGirocardClearing(
                          tariff.girocardClearingIncluded,
                          tariff.girocardClearingFeeTenthsOfCent,
                        )}
                      </dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Girocard</dt>
                      <dd>{formatCardRate(tariff.cardRates.girocard)}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Debitkarten</dt>
                      <dd>{formatCardRate(tariff.cardRates.debit)}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Kreditkarten</dt>
                      <dd>{formatCardRate(tariff.cardRates.credit)}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Einrichtungsgebühr</dt>
                      <dd>{formatCentsToCurrency(tariff.setupFeeCents)}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Vertragslaufzeit</dt>
                      <dd>{formatOptionalMonths(tariff.minimumContractMonths)}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Kündigungsfrist</dt>
                      <dd>{formatOptionalMonths(tariff.noticePeriodMonths)}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Gültigkeit</dt>
                      <dd>{formatValidityRange(tariff.validFrom, tariff.validUntil)}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Zuletzt geändert</dt>
                      <dd>{formatUpdatedAt(tariff.updatedAt)}</dd>
                    </div>
                  </dl>
                </>
              }
              footer={
                <div className={styles.cardActions}>
                  <Link to={`/admin/tariffs/${tariff.id}/edit`}>
                    <Button variant="secondary">Bearbeiten</Button>
                  </Link>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={statusUpdatingId === tariff.id}
                    loading={statusUpdatingId === tariff.id}
                    onClick={() => handleStatusToggle(tariff)}
                  >
                    {statusUpdatingId === tariff.id
                      ? 'Wird aktualisiert…'
                      : tariff.status === 'active'
                        ? 'Deaktivieren'
                        : 'Aktivieren'}
                  </Button>
                </div>
              }
            />
          )}
        />
      )}

      <Dialog
        isOpen={Boolean(deactivateTarget)}
        title="Tarif deaktivieren"
        onClose={() => setDeactivateTarget(null)}
        secondaryAction={{ label: 'Abbrechen', onClick: () => setDeactivateTarget(null) }}
        primaryAction={{ label: 'Tarif deaktivieren', variant: 'destructive', onClick: handleDeactivateConfirmed }}
      >
        <p>Der Tarif steht anschließend nicht mehr für neue Vergleiche zur Verfügung.</p>
      </Dialog>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <AdminLayout title="Tarife" subtitle="BestPay-Tarife für Vergleich und Beratung verwalten" actions={createAction}>
      {content}
    </AdminLayout>
  );
}
