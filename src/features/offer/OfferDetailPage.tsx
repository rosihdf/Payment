import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { EmptyState } from '../../components/feedback/EmptyState';
import { FormField } from '../../components/common/FormField';
import { PageHeader } from '../../components/layout/PageHeader';
import type { Offer } from '../../domain/offer/offer';
import { calculateOfferTotals } from '../../domain/offer/offerCalculations';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import {
  displayDateTime,
  displayText,
  formatContactName,
} from '../../utils/format';
import {
  formatOfferItemPrice,
  formatOfferLineTotal,
  formatOfferItemPriceTypeLabel,
} from '../../utils/formatOffer';
import { formatCardRate, formatGirocardClearing, formatOptionalCents, formatOptionalMonths } from '../../utils/formatTariff';
import { TERMINAL_TYPE_LABELS } from '../../domain/tariff/tariff';
import { OfferStatusBadge } from './OfferStatusBadge';
import { OfferTotalsDisplay } from './OfferTotalsDisplay';
import styles from './OfferDetailPage.module.css';

type DialogMode = 'complete' | 'cancel' | 'duplicate' | null;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { offerService } = useServices();
  const { showToast } = useToast();

  const [offer, setOffer] = useState<Offer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationError, setCancellationError] = useState<string | undefined>();

  const loadOffer = useCallback(async () => {
    if (!id || !currentUser) {
      setIsLoading(false);
      return;
    }

    const result = await offerService.getOfferById(id, {
      userId: currentUser.id,
      role: currentUser.role,
      displayName: currentUser.name,
    });
    setOffer(result);
    setIsLoading(false);
  }, [currentUser, id, offerService]);

  useEffect(() => {
    setIsLoading(true);
    void loadOffer();
  }, [loadOffer]);

  const userContext = currentUser
    ? {
        userId: currentUser.id,
        role: currentUser.role,
        displayName: currentUser.name,
      }
    : null;

  const canEdit = offer && userContext ? offerService.canUserEditOffer(offer, userContext) : false;

  const handleComplete = () => {
    if (!offer || !userContext) {
      return;
    }

    void (async () => {
      setIsActionRunning(true);
      const result = await offerService.completeOffer(offer.id, userContext);

      if (result.ok) {
        showToast('Angebot wurde abgeschlossen', 'success');
        await loadOffer();
      } else if ('errors' in result) {
        showToast('Angebot konnte nicht abgeschlossen werden – bitte prüfen Sie die Pflichtfelder.', 'error');
      } else {
        showToast('Angebot konnte nicht abgeschlossen werden', 'error');
      }

      setIsActionRunning(false);
      setDialogMode(null);
    })();
  };

  const handleCancel = () => {
    if (!offer || !userContext) {
      return;
    }

    const reason = cancellationReason.trim();
    if (!reason) {
      setCancellationError('Bitte geben Sie einen Stornierungsgrund an.');
      return;
    }

    void (async () => {
      setIsActionRunning(true);
      const result = await offerService.cancelOffer(offer.id, reason, userContext);

      if (result.ok) {
        showToast('Angebot wurde storniert', 'success');
        setCancellationReason('');
        setCancellationError(undefined);
        await loadOffer();
      } else if ('errors' in result && result.errors.reason) {
        setCancellationError(result.errors.reason);
        showToast(result.errors.reason, 'error');
      } else {
        showToast('Angebot konnte nicht storniert werden', 'error');
      }

      setIsActionRunning(false);
      setDialogMode(null);
    })();
  };

  const handleDuplicate = () => {
    if (!offer || !userContext) {
      return;
    }

    void (async () => {
      setIsActionRunning(true);
      const result = await offerService.duplicateOfferAsDraft(offer.id, userContext);

      if (result.ok) {
        showToast('Angebot wurde als Entwurf dupliziert', 'success');
        navigate(`/offers/${result.offer.id}/edit`);
      } else {
        showToast('Angebot konnte nicht dupliziert werden', 'error');
      }

      setIsActionRunning(false);
      setDialogMode(null);
    })();
  };

  if (isLoading) {
    return (
      <section>
        <PageHeader title="Angebot" subtitle="Daten werden geladen…" />
        <EmptyState title="Angebot wird geladen" description="Die Angebotsdetails werden abgerufen." />
      </section>
    );
  }

  if (!offer) {
    return (
      <section>
        <PageHeader title="Angebot nicht gefunden" />
        <EmptyState
          title="Angebot nicht gefunden"
          description="Das angeforderte Angebot existiert nicht oder Sie haben keinen Zugriff."
          action={
            <Link className={styles.link} to="/offers">
              Zur Angebotsübersicht
            </Link>
          }
        />
      </section>
    );
  }

  const totals = calculateOfferTotals(offer);
  const contactName = formatContactName(
    offer.customerSnapshot.contactFirstName,
    offer.customerSnapshot.contactLastName,
  );

  return (
    <section>
      <PageHeader
        title={offer.title}
        subtitle={`${offer.offerNumber} · ${offer.customerSnapshot.companyName}`}
        actions={
          <div className={styles.headerActions}>
            {canEdit ? (
              <Link className={styles.secondaryAction} to={`/offers/${offer.id}/edit`}>
                Bearbeiten
              </Link>
            ) : null}
            {offer.status === 'draft' ? (
              <button
                type="button"
                className={styles.primaryAction}
                disabled={isActionRunning}
                onClick={() => setDialogMode('complete')}
              >
                Abschließen
              </button>
            ) : null}
            {offer.status !== 'cancelled' ? (
              <button
                type="button"
                className={styles.secondaryAction}
                disabled={isActionRunning}
                onClick={() => {
                  if (!cancellationReason.trim()) {
                    setCancellationError('Bitte geben Sie einen Stornierungsgrund an.');
                    return;
                  }
                  setCancellationError(undefined);
                  setDialogMode('cancel');
                }}
              >
                Stornieren
              </button>
            ) : null}
            {offer.status !== 'draft' ? (
              <button
                type="button"
                className={styles.secondaryAction}
                disabled={isActionRunning}
                onClick={() => setDialogMode('duplicate')}
              >
                Als Entwurf duplizieren
              </button>
            ) : null}
            <Link className={styles.link} to="/offers">
              Zur Übersicht
            </Link>
          </div>
        }
      />

      <div className={styles.statusRow}>
        <OfferStatusBadge status={offer.status} />
        <span className={styles.meta}>Erstellt von {offer.createdByDisplayName}</span>
      </div>

      <section className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Kunde</h2>
        <dl className={styles.grid}>
          <DetailRow label="Firma" value={displayText(offer.customerSnapshot.companyName)} />
          <DetailRow label="Ansprechpartner" value={displayText(contactName)} />
          <DetailRow label="Telefon" value={displayText(offer.customerSnapshot.phone)} />
          <DetailRow label="E-Mail" value={displayText(offer.customerSnapshot.email)} />
          <DetailRow
            label="Anschrift"
            value={displayText(
              [
                offer.customerSnapshot.street,
                `${offer.customerSnapshot.postalCode} ${offer.customerSnapshot.city}`.trim(),
              ]
                .filter(Boolean)
                .join(', '),
            )}
          />
          <div className={styles.row}>
            <dt>Lead</dt>
            <dd>
              <Link className={styles.inlineLink} to={`/leads/${offer.leadId}`}>
                Lead anzeigen
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      {offer.tariffSnapshot ? (
        <section className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Payment-Tarif</h2>
          <dl className={styles.grid}>
            <DetailRow label="Tarif" value={displayText(offer.tariffSnapshot.name)} />
            <DetailRow label="Anbieter" value={displayText(offer.tariffSnapshot.providerName)} />
            <DetailRow
              label="Einsatzart"
              value={TERMINAL_TYPE_LABELS[offer.tariffSnapshot.terminalType]}
            />
            <DetailRow
              label="Monatliche Fixkosten"
              value={formatOptionalCents(totals.tariffMonthlyFixedTotalCents) + ' / Monat'}
            />
            <DetailRow
              label="Einrichtungsgebühr"
              value={formatOptionalCents(offer.tariffSnapshot.setupFeeCents) + ' einmalig'}
            />
            <DetailRow label="Girocard" value={formatCardRate({
              percentageTenthsOfBasisPoint: offer.tariffSnapshot.girocardRateTenthsOfBasisPoint,
              fixedFeeTenthsOfCent: 0,
            })} />
            <DetailRow
              label="Girocard-Clearing"
              value={formatGirocardClearing(
                offer.tariffSnapshot.girocardClearingIncluded,
                offer.tariffSnapshot.girocardClearingFeeTenthsOfCent,
              )}
            />
            <DetailRow
              label="Vertragslaufzeit"
              value={formatOptionalMonths(offer.tariffSnapshot.contractDurationMonths)}
            />
          </dl>
        </section>
      ) : null}

      <section className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Positionen</h2>
        {offer.items.length === 0 ? (
          <p className={styles.emptyHint}>Keine Positionen vorhanden.</p>
        ) : (
          <ul className={styles.itemList}>
            {offer.items.map((item) => (
              <li key={item.id} className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <h3 className={styles.itemTitle}>{item.name}</h3>
                  <span className={styles.itemType}>
                    {item.type === 'product' ? 'Produkt' : 'Manuell'}
                  </span>
                </div>
                {item.description ? <p className={styles.itemDescription}>{item.description}</p> : null}
                <dl className={styles.itemDetails}>
                  <DetailRow label="Menge" value={String(item.quantity)} />
                  <DetailRow
                    label="Preisart"
                    value={formatOfferItemPriceTypeLabel(item.priceType)}
                  />
                  <DetailRow
                    label="Einzelpreis"
                    value={formatOfferItemPrice(item.priceType, item.unitPriceCents)}
                  />
                  <DetailRow label="Zeilensumme" value={formatOfferLineTotal(item)} />
                  {item.priceOverridden ? (
                    <DetailRow
                      label="Preisüberschreibung"
                      value={displayText(item.priceOverrideReason)}
                    />
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Angebotsdetails</h2>
        <dl className={styles.grid}>
          <DetailRow label="Gültig bis" value={displayDateTime(offer.validUntil)} />
          <DetailRow label="Einleitungstext" value={displayText(offer.introductionText)} />
          <DetailRow label="Hinweise für den Kunden" value={displayText(offer.customerNotes)} />
          <DetailRow label="Interne Hinweise" value={displayText(offer.internalNotes)} />
        </dl>
        <OfferTotalsDisplay totals={totals} />
      </section>

      <section className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Metadaten</h2>
        <dl className={styles.grid}>
          <DetailRow label="Erstellt am" value={displayDateTime(offer.createdAt)} />
          <DetailRow label="Zuletzt geändert" value={displayDateTime(offer.updatedAt)} />
          {offer.completedAt ? (
            <DetailRow label="Abgeschlossen am" value={displayDateTime(offer.completedAt)} />
          ) : null}
          {offer.cancelledAt ? (
            <DetailRow label="Storniert am" value={displayDateTime(offer.cancelledAt)} />
          ) : null}
          {offer.cancellationReason ? (
            <DetailRow label="Stornierungsgrund" value={displayText(offer.cancellationReason)} />
          ) : null}
        </dl>
      </section>

      <ConfirmDialog
        isOpen={dialogMode === 'complete'}
        title="Angebot abschließen"
        message="Das Angebot wird als abgeschlossen markiert und kann danach nicht mehr bearbeitet werden."
        cancelLabel="Abbrechen"
        confirmLabel="Angebot abschließen"
        onCancel={() => setDialogMode(null)}
        onConfirm={handleComplete}
      />

      <ConfirmDialog
        isOpen={dialogMode === 'duplicate'}
        title="Angebot duplizieren"
        message="Es wird ein neuer Entwurf mit denselben Inhalten angelegt."
        cancelLabel="Abbrechen"
        confirmLabel="Als Entwurf duplizieren"
        onCancel={() => setDialogMode(null)}
        onConfirm={handleDuplicate}
      />

      {offer.status !== 'cancelled' ? (
        <section className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Stornierung</h2>
          <FormField
            id="cancellationReason"
            label="Stornierungsgrund"
            required
            error={cancellationError}
          >
            <textarea
              id="cancellationReason"
              className={styles.textarea}
              value={cancellationReason}
              disabled={isActionRunning}
              aria-invalid={Boolean(cancellationError)}
              onChange={(event) => {
                setCancellationReason(event.target.value);
                setCancellationError(undefined);
              }}
            />
          </FormField>
        </section>
      ) : null}

      <ConfirmDialog
        isOpen={dialogMode === 'cancel'}
        title="Angebot stornieren"
        message="Das Angebot wird storniert und kann danach nicht mehr bearbeitet werden."
        cancelLabel="Abbrechen"
        confirmLabel="Angebot stornieren"
        onCancel={() => setDialogMode(null)}
        onConfirm={handleCancel}
      />
    </section>
  );
}
