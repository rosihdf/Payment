import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { canCancelOfferWorkflow } from '../../domain/offer/offerDraftDeletion';
import { getLeadDisplayName } from '../../domain/lead/getLeadDisplayName';
import type { Offer, OfferFilters } from '../../domain/offer/offer';
import {
  getOfferPrimaryStatusBadgeVariant,
  getOfferPrimaryStatusLabel,
  OFFER_PHASE_FILTER_LABELS,
  OFFER_PHASE_FILTER_OPTIONS,
  type OfferPhaseFilter,
} from '../../features/offer/offerWorkflowDisplay';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import { formatContactName, formatDate } from '../../utils/format';
import { formatOptionalMonths } from '../../utils/formatTariff';
import { Button } from '../ui/Button';
import { DataList, DataListCard } from '../ui/DataList';
import { Dialog } from '../ui/Dialog';
import { FormField, textareaClassName } from '../ui/FormField';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import styles from './OffersPage.module.css';

const OWNER_FILTER_OPTIONS: Array<{ value: OfferFilters['owner']; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'mine', label: 'Meine Angebote' },
];

const DOCUMENT_PHASES = new Set([
  'approval_required',
  'in_approval',
  'changes_requested',
  'approved',
  'ready_to_send',
  'sent',
  'accepted',
  'declined',
  'expired',
  'activation_pending',
  'activated',
  'released',
  'accounted',
  'paid',
  'cancelled',
]);

type DialogMode = 'cancel' | 'delete' | null;

interface OfferCardActionsProps {
  offer: Offer;
  isAdmin: boolean;
  isActionRunning: boolean;
  onCancel: (offer: Offer) => void;
  onDelete: (offer: Offer) => void;
}

function OfferCardActions({
  offer,
  isAdmin,
  isActionRunning,
  onCancel,
  onDelete,
}: OfferCardActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [menuOpen]);

  const contactName = formatContactName(
    offer.customerSnapshot.contactFirstName,
    offer.customerSnapshot.contactLastName,
  );
  const showDocuments = DOCUMENT_PHASES.has(offer.workflowStatus) || offer.status === 'completed';
  const showCancel = canCancelOfferWorkflow(offer.workflowStatus) && offer.status !== 'cancelled';
  const showDelete = isAdmin && offer.workflowStatus === 'draft';

  return (
    <div className={styles.cardActions} ref={menuRef}>
      <button
        type="button"
        className={styles.menuButton}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        disabled={isActionRunning}
        onClick={() => setMenuOpen((current) => !current)}
      >
        Aktionen
      </button>
      {menuOpen ? (
        <div className={styles.menu} role="menu">
          <Link
            className={styles.menuItem}
            role="menuitem"
            to={`/offers/${offer.id}`}
            onClick={() => setMenuOpen(false)}
          >
            Öffnen
          </Link>
          {showDocuments ? (
            <>
              <Link
                className={styles.menuItem}
                role="menuitem"
                to={`/offers/${offer.id}?tab=versions`}
                onClick={() => setMenuOpen(false)}
              >
                Dokumente
              </Link>
              <Link
                className={styles.menuItem}
                role="menuitem"
                to={`/offers/${offer.id}/preview`}
                onClick={() => setMenuOpen(false)}
              >
                PDF-Vorschau
              </Link>
            </>
          ) : null}
          {showCancel ? (
            <button
              type="button"
              className={styles.menuItemButton}
              role="menuitem"
              disabled={isActionRunning}
              onClick={() => {
                setMenuOpen(false);
                onCancel(offer);
              }}
            >
              Stornieren
            </button>
          ) : null}
          {showDelete ? (
            <button
              type="button"
              className={`${styles.menuItemButton} ${styles.menuItemDanger}`}
              role="menuitem"
              disabled={isActionRunning}
              onClick={() => {
                setMenuOpen(false);
                onDelete(offer);
              }}
            >
              Entwurf löschen
            </button>
          ) : null}
          {contactName ? (
            <span className={styles.menuHint} aria-hidden="true">
              {contactName}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function OffersPage() {
  const { currentUser } = useCurrentUser();
  const { offerService } = useServices();
  const { showToast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [activeOffer, setActiveOffer] = useState<Offer | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationError, setCancellationError] = useState<string | undefined>();
  const [filters, setFilters] = useState<OfferFilters>({
    search: '',
    phase: 'all',
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

  const userContext = useMemo(
    () =>
      currentUser
        ? {
            userId: currentUser.id,
            role: currentUser.role,
            displayName: currentUser.name,
          }
        : null,
    [currentUser],
  );

  const handleCancelRequest = (offer: Offer) => {
    setActiveOffer(offer);
    setCancellationReason('');
    setCancellationError(undefined);
    setDialogMode('cancel');
  };

  const handleDeleteRequest = (offer: Offer) => {
    setActiveOffer(offer);
    setDialogMode('delete');
  };

  const handleCancelConfirm = () => {
    if (!activeOffer || !userContext) {
      return;
    }

    const reason = cancellationReason.trim();
    if (!reason) {
      setCancellationError('Bitte geben Sie einen Stornierungsgrund an.');
      return;
    }

    void (async () => {
      setIsActionRunning(true);
      const result = await offerService.cancelOffer(activeOffer.id, reason, userContext);

      if (result.ok) {
        showToast('Angebot wurde storniert', 'success');
        setDialogMode(null);
        setActiveOffer(null);
        await loadOffers();
      } else if ('errors' in result && result.errors.reason) {
        setCancellationError(result.errors.reason);
        showToast(result.errors.reason, 'error');
      } else {
        showToast('Angebot konnte nicht storniert werden', 'error');
      }

      setIsActionRunning(false);
    })();
  };

  const handleDeleteConfirm = () => {
    if (!activeOffer || !userContext) {
      return;
    }

    void (async () => {
      setIsActionRunning(true);
      const result = await offerService.deleteDraftOffer(activeOffer.id, userContext);

      if (result.ok) {
        showToast('Entwurf wurde gelöscht', 'success');
        setDialogMode(null);
        setActiveOffer(null);
        await loadOffers();
      } else if ('message' in result && result.message) {
        showToast(result.message, 'error');
      } else {
        showToast('Entwurf konnte nicht gelöscht werden', 'error');
      }

      setIsActionRunning(false);
    })();
  };

  return (
    <section>
      <PageHeader
        title="Angebote"
        description="Angebote zum Kunden – bevorzugt über Beratung und Kundenakte öffnen"
        actions={
          <Link to="/offers/new">
            <Button>Neues Angebot</Button>
          </Link>
        }
      />

      <div className={styles.search}>
        <FormField
          type="search"
          label="Suche"
          value={filters.search}
          onChange={(event) =>
            setFilters((current) => ({ ...current, search: event.target.value }))
          }
          placeholder="Angebotsnummer, Titel, Kunde, Tarif…"
        />
      </div>

      <div className={styles.filters}>
        <fieldset className={styles.filterGroup}>
          <legend className={styles.filterLegend}>Phase</legend>
          <div className={styles.filterOptions}>
            {OFFER_PHASE_FILTER_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`${styles.filterButton} ${
                  filters.phase === option ? styles.filterButtonActive : ''
                }`}
                aria-pressed={filters.phase === option}
                onClick={() =>
                  setFilters((current) => ({ ...current, phase: option as OfferPhaseFilter }))
                }
              >
                {OFFER_PHASE_FILTER_LABELS[option]}
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

      {isLoading ? (
        <EmptyState title="Angebote werden geladen" description="Die Angebotsliste wird vorbereitet." />
      ) : filteredOffers.length === 0 ? (
        <EmptyState
          title="Keine Angebote gefunden"
          description="Für die aktuelle Suche oder Filterkombination liegen keine Angebote vor."
          action={
            <Link to="/offers/new">
              <Button>Neues Angebot</Button>
            </Link>
          }
        />
      ) : (
        <DataList
          items={filteredOffers}
          getKey={(offer) => offer.id}
          aria-label="Angebotsliste"
          renderItem={(offer) => {
            const contactName = formatContactName(
              offer.customerSnapshot.contactFirstName,
              offer.customerSnapshot.contactLastName,
            );

            return (
              <DataListCard
                href={`/offers/${offer.id}`}
                title={
                  <>
                    <span className={styles.offerNumber}>{offer.offerNumber}</span>
                    <span className={styles.offerTitle}>{offer.title}</span>
                  </>
                }
                badge={
                  <StatusBadge
                    variant={getOfferPrimaryStatusBadgeVariant(offer.workflowStatus)}
                    label={getOfferPrimaryStatusLabel(offer.workflowStatus)}
                  />
                }
                meta={
                  <>
                    <span>{getLeadDisplayName(offer.customerSnapshot)}</span>
                    {contactName ? <span>{contactName}</span> : null}
                    {offer.tariffSnapshot ? <span>Tarif: {offer.tariffSnapshot.name}</span> : null}
                    <span>
                      Laufzeit:{' '}
                      {formatOptionalMonths(offer.tariffSnapshot?.contractDurationMonths ?? null)}
                    </span>
                    <span>Aktualisiert: {formatDate(offer.updatedAt)}</span>
                  </>
                }
                footer={
                  currentUser ? (
                    <OfferCardActions
                      offer={offer}
                      isAdmin={currentUser.role === 'admin'}
                      isActionRunning={isActionRunning}
                      onCancel={handleCancelRequest}
                      onDelete={handleDeleteRequest}
                    />
                  ) : null
                }
              />
            );
          }}
        />
      )}

      <Dialog
        isOpen={dialogMode === 'cancel'}
        title="Angebot stornieren"
        onClose={() => {
          if (!isActionRunning) {
            setDialogMode(null);
            setActiveOffer(null);
          }
        }}
        secondaryAction={{
          label: 'Abbrechen',
          onClick: () => {
            setDialogMode(null);
            setActiveOffer(null);
          },
          disabled: isActionRunning,
        }}
        primaryAction={{
          label: 'Stornieren',
          onClick: handleCancelConfirm,
          loading: isActionRunning,
        }}
      >
        <p>
          {activeOffer
            ? `Angebot ${activeOffer.offerNumber} wirklich stornieren?`
            : 'Angebot wirklich stornieren?'}
        </p>
        <label htmlFor="listCancellationReason">Stornierungsgrund</label>
        <textarea
          id="listCancellationReason"
          className={textareaClassName(cancellationError)}
          value={cancellationReason}
          disabled={isActionRunning}
          aria-invalid={Boolean(cancellationError)}
          onChange={(event) => {
            setCancellationReason(event.target.value);
            setCancellationError(undefined);
          }}
        />
        {cancellationError ? (
          <p role="alert">{cancellationError}</p>
        ) : null}
      </Dialog>

      <Dialog
        isOpen={dialogMode === 'delete'}
        title="Entwurf löschen"
        onClose={() => {
          if (!isActionRunning) {
            setDialogMode(null);
            setActiveOffer(null);
          }
        }}
        secondaryAction={{
          label: 'Abbrechen',
          onClick: () => {
            setDialogMode(null);
            setActiveOffer(null);
          },
          disabled: isActionRunning,
        }}
        primaryAction={{
          label: 'Endgültig löschen',
          variant: 'destructive',
          onClick: handleDeleteConfirm,
          loading: isActionRunning,
        }}
      >
        <p>
          {activeOffer
            ? `Entwurf ${activeOffer.offerNumber} unwiderruflich löschen? Nur echte Entwürfe ohne Folgedaten sind erlaubt.`
            : 'Entwurf unwiderruflich löschen?'}
        </p>
      </Dialog>
    </section>
  );
}
