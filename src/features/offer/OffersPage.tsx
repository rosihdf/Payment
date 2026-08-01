import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { FormControl } from '../../components/common/FormControl';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  OFFER_STATUS_LABELS,
  type Offer,
  type OfferFilters,
  type OfferStatusFilter,
} from '../../domain/offer/offer';
import {
  OFFER_WORKFLOW_STATUS_LABELS,
  type OfferWorkflowStatusFilter,
} from '../../domain/offer/offerWorkflow';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { OfferCard } from './OfferCard';
import styles from './OffersPage.module.css';

const STATUS_FILTER_OPTIONS: Array<{ value: OfferStatusFilter; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'draft', label: OFFER_STATUS_LABELS.draft },
  { value: 'completed', label: OFFER_STATUS_LABELS.completed },
  { value: 'cancelled', label: OFFER_STATUS_LABELS.cancelled },
];

const WORKFLOW_FILTER_OPTIONS: Array<{ value: OfferWorkflowStatusFilter; label: string }> = [
  { value: 'all', label: 'Alle Workflow-Status' },
  { value: 'draft', label: OFFER_WORKFLOW_STATUS_LABELS.draft },
  { value: 'approval_required', label: OFFER_WORKFLOW_STATUS_LABELS.approval_required },
  { value: 'in_approval', label: OFFER_WORKFLOW_STATUS_LABELS.in_approval },
  { value: 'ready_to_send', label: OFFER_WORKFLOW_STATUS_LABELS.ready_to_send },
  { value: 'sent', label: OFFER_WORKFLOW_STATUS_LABELS.sent },
  { value: 'accepted', label: OFFER_WORKFLOW_STATUS_LABELS.accepted },
  { value: 'declined', label: OFFER_WORKFLOW_STATUS_LABELS.declined },
  { value: 'expired', label: OFFER_WORKFLOW_STATUS_LABELS.expired },
  { value: 'activation_pending', label: OFFER_WORKFLOW_STATUS_LABELS.activation_pending },
  { value: 'activated', label: OFFER_WORKFLOW_STATUS_LABELS.activated },
  { value: 'released', label: OFFER_WORKFLOW_STATUS_LABELS.released },
  { value: 'accounted', label: OFFER_WORKFLOW_STATUS_LABELS.accounted },
  { value: 'paid', label: OFFER_WORKFLOW_STATUS_LABELS.paid },
  { value: 'cancelled', label: OFFER_WORKFLOW_STATUS_LABELS.cancelled },
];

const OWNER_FILTER_OPTIONS: Array<{ value: OfferFilters['owner']; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'mine', label: 'Meine Angebote' },
];

export function OffersPage() {
  const { currentUser } = useCurrentUser();
  const { offerService } = useServices();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<OfferFilters>({
    search: '',
    status: 'all',
    workflowStatus: 'all',
    owner: 'all',
  });

  const loadOffers = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    const result = await offerService.getOffers({
      userId: currentUser.id,
      role: currentUser.role,
      displayName: currentUser.name,
    });
    setOffers(result);
    setIsLoading(false);
  }, [currentUser, offerService]);

  useEffect(() => {
    setIsLoading(true);
    void loadOffers();
  }, [loadOffers]);

  const filteredOffers = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    return offerService.filterOffers(offers, filters, {
      userId: currentUser.id,
      role: currentUser.role,
      displayName: currentUser.name,
    });
  }, [currentUser, filters, offerService, offers]);

  return (
    <section>
      <PageHeader
        title="Angebote"
        subtitle="Angebote zum Kunden – bevorzugt über Beratung und Kundenakte öffnen"
        actions={
          <Link className={styles.primaryAction} to="/offers/new">
            Neues Angebot
          </Link>
        }
      />

      <div className={styles.toolbar}>
        <FormControl
          type="search"
          label="Suche"
          value={filters.search}
          onChange={(event) =>
            setFilters((current) => ({ ...current, search: event.target.value }))
          }
          placeholder="Angebotsnummer, Titel, Kunde, Tarif…"
        />

        <div className={styles.filters}>
          <fieldset className={styles.filterGroup}>
            <legend className={styles.filterLegend}>Status</legend>
            <div className={styles.filterOptions}>
              {STATUS_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.filterButton} ${
                    filters.status === option.value ? styles.filterButtonActive : ''
                  }`}
                  aria-pressed={filters.status === option.value}
                  onClick={() => setFilters((current) => ({ ...current, status: option.value }))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.filterGroup}>
            <legend className={styles.filterLegend}>Workflow</legend>
            <div className={styles.filterOptions}>
              {WORKFLOW_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.filterButton} ${
                    filters.workflowStatus === option.value ? styles.filterButtonActive : ''
                  }`}
                  aria-pressed={filters.workflowStatus === option.value}
                  onClick={() =>
                    setFilters((current) => ({ ...current, workflowStatus: option.value }))
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          {currentUser?.role === 'admin' ? (
            <fieldset className={styles.filterGroup}>
              <legend className={styles.filterLegend}>Ersteller</legend>
              <div className={styles.filterOptions}>
                {OWNER_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.filterButton} ${
                      filters.owner === option.value ? styles.filterButtonActive : ''
                    }`}
                    aria-pressed={filters.owner === option.value}
                    onClick={() => setFilters((current) => ({ ...current, owner: option.value }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <EmptyState title="Angebote werden geladen" description="Die Angebotsliste wird vorbereitet." />
      ) : filteredOffers.length === 0 ? (
        <EmptyState
          title="Keine Angebote gefunden"
          description="Für die aktuelle Suche oder Filterkombination liegen keine Angebote vor."
          action={
            <Link className={styles.primaryAction} to="/offers/new">
              Neues Angebot
            </Link>
          }
        />
      ) : (
        <ul className={styles.list}>
          {filteredOffers.map((offer) => (
            <li key={offer.id}>
              <OfferCard
                offer={offer}
                actions={
                  <Link className={styles.secondaryAction} to={`/offers/${offer.id}`}>
                    Details anzeigen
                  </Link>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
