import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import type { Contract } from '../../domain/contract/contract';
import type { Offer } from '../../domain/offer/offer';
import { OFFER_STATUS_LABELS } from '../../domain/offer/offer';
import { calculateOfferTotals } from '../../domain/offer/offerCalculations';
import { getLeadDisplayName } from '../../domain/lead/getLeadDisplayName';
import { hasPermission } from '../../domain/permission/permission';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../hooks/useToast';
import { displayDateTime, displayText, formatContactName } from '../../utils/format';
import {
  formatOfferItemPrice,
  formatOfferLineTotal,
  formatOfferItemPriceTypeLabel,
} from '../../utils/formatOffer';
import { formatCardRate, formatGirocardClearing, formatOptionalCents, formatOptionalMonths } from '../../utils/formatTariff';
import { TERMINAL_TYPE_LABELS } from '../../domain/tariff/tariff';
import { OfferDocumentsSection } from '../../features/offerDocument/OfferDocumentsSection';
import { OfferCommissionSection } from '../../features/offer/OfferCommissionSection';
import { OfferPricingEvaluationSection } from '../../features/offer/OfferPricingEvaluationSection';
import { OfferRecommendationSection } from '../../features/offer/OfferRecommendationSection';
import { OfferTotalsDisplay } from '../../features/offer/OfferTotalsDisplay';
import { OfferFulfillmentCard } from '../../features/offer/OfferFulfillmentCard';
import { OfferCustomerFeedbackSection } from '../../features/offer/OfferCustomerFeedbackSection';
import { OfferCustomerShareSection } from '../../features/offer/OfferCustomerShareSection';
import { OfferWorkflowSection } from '../../features/offer/OfferWorkflowSection';
import {
  getOfferWorkflowDisplayGroup,
  getOfferWorkflowDisplayLabel,
  getOfferWorkflowTechnicalLabel,
  type OfferWorkflowDisplayGroup,
} from '../../features/offer/offerWorkflowDisplay';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge, type StatusBadgeVariant } from '../ui/StatusBadge';
import { textareaClassName } from '../ui/FormField';
import styles from './OfferDetailPage.module.css';

const OfferBillingImportSection = lazy(async () => {
  const module = await import('../../features/offer/OfferBillingImportSection');
  return { default: module.OfferBillingImportSection };
});

type DialogMode = 'complete' | 'cancel' | 'duplicate' | null;
type TabId = 'overview' | 'positions' | 'workflow' | 'versions' | 'commission';

function offerWorkflowStatusVariant(group: OfferWorkflowDisplayGroup): StatusBadgeVariant {
  switch (group) {
    case 'draft':
      return 'neutral';
    case 'internal_review':
      return 'warning';
    case 'ready_for_customer':
    case 'customer_review':
      return 'info';
    case 'accepted':
      return 'success';
    case 'closed':
      return 'danger';
    default:
      return 'neutral';
  }
}

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
  const {
    offerService,
    offerDocumentService,
    pricingEvaluationService,
    commissionCalculationService,
    recommendationService,
    billingImportService,
    contractService,
  } = useServices();
  const { showToast } = useToast();

  const [offer, setOffer] = useState<Offer | null>(null);
  const [linkedContract, setLinkedContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationError, setCancellationError] = useState<string | undefined>();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<TabId>(
    initialTab === 'workflow' ||
      initialTab === 'positions' ||
      initialTab === 'versions' ||
      initialTab === 'commission'
      ? initialTab
      : 'overview',
  );

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
    if (result) {
      const contract = await contractService.getByOfferId(id, {
        userId: currentUser.id,
        role: currentUser.role,
        displayName: currentUser.name,
        status: currentUser.status,
      });
      setLinkedContract(contract);
    } else {
      setLinkedContract(null);
    }
    setIsLoading(false);
  }, [currentUser, id, offerService, contractService]);

  useEffect(() => {
    setIsLoading(true);
    void loadOffer();
  }, [loadOffer]);

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

  const canEdit = offer && userContext ? offerService.canUserEditOffer(offer, userContext) : false;
  const canViewCommission = currentUser ? hasPermission(currentUser.role, 'commission.view') : false;
  const canCreateContract =
    userContext &&
    hasPermission(userContext.role, 'contracts.create') &&
    ['accepted', 'activation_pending', 'activated', 'released', 'accounted', 'paid'].includes(
      offer?.workflowStatus ?? '',
    );

  const handleCreateContract = () => {
    if (!offer || !userContext || !currentUser) return;

    void (async () => {
      setIsActionRunning(true);
      const result = await contractService.createFromAcceptedOffer(offer.id, {
        ...userContext,
        status: currentUser.status,
      });
      if (result.ok) {
        showToast(`Vertrag ${result.value.contractNumber} angelegt`, 'success');
        setLinkedContract(result.value);
        navigate(`/contracts/${result.value.id}`);
      } else {
        showToast(result.message ?? 'Vertrag konnte nicht angelegt werden', 'error');
      }
      setIsActionRunning(false);
    })();
  };

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
        <PageHeader title="Angebot" description="Daten werden geladen…" />
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
            <Link to="/offers">
              <Button variant="secondary">Zur Angebotsübersicht</Button>
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
  const showTechnical = currentUser?.role === 'admin';
  const workflowGroup = getOfferWorkflowDisplayGroup(offer.workflowStatus);
  const standLabel = getOfferWorkflowDisplayLabel(offer.workflowStatus);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'positions', label: 'Positionen & Konditionen' },
    { id: 'workflow', label: 'Freigabe & Versand' },
    { id: 'versions', label: 'Versionen & Dokumente' },
  ];
  if (canViewCommission) {
    tabs.push({ id: 'commission', label: 'Interne Provision' });
  }

  const canCreateContractNow = Boolean(!linkedContract && canCreateContract);
  const primaryIsComplete = offer.status === 'draft';
  const primaryIsCreateContract = !primaryIsComplete && canCreateContractNow;
  const primaryIsDuplicate = !primaryIsComplete && !primaryIsCreateContract && offer.status !== 'draft';

  let primaryAction: ReactNode = null;
  if (primaryIsComplete) {
    primaryAction = (
      <Button disabled={isActionRunning} onClick={() => setDialogMode('complete')}>
        Abschließen
      </Button>
    );
  } else if (primaryIsCreateContract) {
    primaryAction = (
      <Button disabled={isActionRunning} onClick={handleCreateContract}>
        Vertrag anlegen
      </Button>
    );
  } else if (primaryIsDuplicate) {
    primaryAction = (
      <Button disabled={isActionRunning} onClick={() => setDialogMode('duplicate')}>
        Als Entwurf duplizieren
      </Button>
    );
  }

  return (
    <section>
      <PageHeader
        title={offer.title}
        description={`${getLeadDisplayName(offer.customerSnapshot)} · ${offer.offerNumber}`}
        actions={
          <div className={styles.headerActions}>
            {offer.leadId ? (
              <Link to={`/leads/${offer.leadId}`}>
                <Button variant="secondary">Zur Kundenakte</Button>
              </Link>
            ) : null}
            {canEdit ? (
              <Link to={`/offers/${offer.id}/edit`}>
                <Button variant="secondary">Bearbeiten</Button>
              </Link>
            ) : offer.status !== 'draft' && !primaryIsDuplicate ? (
              <Button variant="secondary" disabled={isActionRunning} onClick={() => setDialogMode('duplicate')}>
                Als Entwurf duplizieren
              </Button>
            ) : null}
            {primaryAction}
          </div>
        }
      />

      <div className={styles.statusRow}>
        <StatusBadge
          variant={offerWorkflowStatusVariant(workflowGroup)}
          label={standLabel}
          technicalLabel={showTechnical ? getOfferWorkflowTechnicalLabel(offer.workflowStatus) : undefined}
        />
        {offer.status === 'completed' || offer.status === 'cancelled' ? (
          <span className={styles.meta}>{OFFER_STATUS_LABELS[offer.status]}</span>
        ) : null}
        <span className={styles.meta}>Stand: {standLabel}</span>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Angebotsbereiche">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`offer-tab-${entry.id}`}
            aria-selected={tab === entry.id}
            aria-controls={`offer-panel-${entry.id}`}
            className={`${styles.tab} ${tab === entry.id ? styles.tabActive : ''}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div
          className={styles.detailSection}
          role="tabpanel"
          id="offer-panel-overview"
          aria-labelledby="offer-tab-overview"
        >
          <h2 className={styles.sectionTitle}>Übersicht</h2>
          <dl className={styles.grid}>
            <DetailRow label="Version" value={String(offer.currentVersionNumber)} />
            <DetailRow label="Ansprechpartner" value={displayText(contactName)} />
            <DetailRow label="Gesamtbetrag (monatlich)" value={`${formatOptionalCents(totals.monthlyTotalCents)} / Monat`} />
            <DetailRow label="Gesamtbetrag (einmalig)" value={formatOptionalCents(totals.oneTimeTotalCents)} />
            <DetailRow
              label="Laufzeit"
              value={formatOptionalMonths(offer.tariffSnapshot?.contractDurationMonths ?? null)}
            />
            <DetailRow label="Verständlicher Stand" value={standLabel} />
            <DetailRow
              label="Nächste Aktion"
              value={
                offer.status === 'draft'
                  ? 'Angebot abschließen oder Freigabe starten'
                  : linkedContract
                    ? 'In Vertrag / Kundenakte fortsetzen'
                    : canCreateContract
                      ? 'Vertrag anlegen'
                      : 'Status prüfen'
              }
            />
            <DetailRow label="Gültig bis" value={displayDateTime(offer.validUntil)} />
            {offer.completedAt ? (
              <DetailRow label="Abgeschlossen am" value={displayDateTime(offer.completedAt)} />
            ) : null}
          </dl>

          {offer.items.length > 0 ? (
            <p className={styles.sectionHint}>
              Positionen: {offer.items.map((item) => item.name).join(', ')}
            </p>
          ) : null}

          {offer.tariffSnapshot ? (
            <p className={styles.sectionHint}>Tarif: {offer.tariffSnapshot.name}</p>
          ) : null}

          <OfferTotalsDisplay totals={totals} />

          {['accepted', 'activation_pending', 'activated', 'released', 'accounted', 'paid'].includes(
            offer.workflowStatus,
          ) ? (
            <OfferFulfillmentCard offer={offer} onUpdated={loadOffer} />
          ) : null}

          {linkedContract ? (
            <p className={styles.sectionHint}>
              <Link className={styles.inlineLink} to={`/contracts/${linkedContract.id}`}>
                Zum Vertrag
              </Link>
            </p>
          ) : null}

          {offer.status !== 'cancelled' ? (
            <div className={styles.moreActions}>
              <h3 className={styles.sectionTitle}>Stornierung</h3>
              <div>
                <label htmlFor="cancellationReason">
                  Stornierungsgrund
                </label>
                <textarea
                  id="cancellationReason"
                  className={textareaClassName(cancellationError)}
                  value={cancellationReason}
                  disabled={isActionRunning}
                  aria-invalid={Boolean(cancellationError)}
                  aria-describedby={cancellationError ? 'cancellationReason-error' : undefined}
                  onChange={(event) => {
                    setCancellationReason(event.target.value);
                    setCancellationError(undefined);
                  }}
                />
                {cancellationError ? (
                  <p id="cancellationReason-error" role="alert">
                    {cancellationError}
                  </p>
                ) : null}
              </div>
              <Button
                variant="secondary"
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
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'positions' ? (
        <div
          className={styles.detailSection}
          role="tabpanel"
          id="offer-panel-positions"
          aria-labelledby="offer-tab-positions"
        >
          <h2 className={styles.sectionTitle}>Positionen & Konditionen</h2>
          {offer.tariffSnapshot ? (
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
              <DetailRow
                label="Girocard"
                value={formatCardRate({
                  percentageTenthsOfBasisPoint: offer.tariffSnapshot.girocardRateTenthsOfBasisPoint,
                  fixedFeeTenthsOfCent: 0,
                })}
              />
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
          ) : (
            <p className={styles.emptyHint}>Kein Payment-Tarif verknüpft.</p>
          )}

          <h3 className={styles.sectionTitle}>Positionen</h3>
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
                    <DetailRow label="Preisart" value={formatOfferItemPriceTypeLabel(item.priceType)} />
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

          {userContext ? (
            <Suspense fallback={<p className={styles.sectionHint}>Abrechnungsimport wird vorbereitet…</p>}>
              <OfferBillingImportSection
                offer={offer}
                userContext={userContext}
                billingImportService={billingImportService}
                showToast={showToast}
                onBaselineConfirmed={() => {
                  void loadOffer();
                }}
              />
            </Suspense>
          ) : null}

          {userContext ? (
            <OfferRecommendationSection
              offer={offer}
              userContext={userContext}
              recommendationService={recommendationService}
              showToast={showToast}
            />
          ) : null}

          {userContext ? (
            <OfferPricingEvaluationSection
              offer={offer}
              userContext={userContext}
              pricingEvaluationService={pricingEvaluationService}
              showToast={showToast}
            />
          ) : null}

          <dl className={styles.grid}>
            <DetailRow label="Einleitungstext" value={displayText(offer.introductionText)} />
            <DetailRow label="Hinweise für den Kunden" value={displayText(offer.customerNotes)} />
            <DetailRow label="Interne Hinweise" value={displayText(offer.internalNotes)} />
          </dl>
          <OfferTotalsDisplay totals={totals} />
        </div>
      ) : null}

      {tab === 'workflow' ? (
        <div role="tabpanel" id="offer-panel-workflow" aria-labelledby="offer-tab-workflow">
          <OfferWorkflowSection
            offer={offer}
            onUpdated={loadOffer}
            mode="actions"
            hideHeaderBadge
            hideNextActionBanner
          />
          {userContext ? (
            <OfferCustomerShareSection
              offer={offer}
              userContext={userContext}
              onUpdated={loadOffer}
            />
          ) : null}
          {userContext ? (
            <OfferCustomerFeedbackSection
              offer={offer}
              userContext={userContext}
              onUpdated={loadOffer}
            />
          ) : null}
        </div>
      ) : null}

      {tab === 'versions' ? (
        <div role="tabpanel" id="offer-panel-versions" aria-labelledby="offer-tab-versions">
          <OfferWorkflowSection
            offer={offer}
            onUpdated={loadOffer}
            mode="versions"
            hideHeaderBadge
            hideNextActionBanner
          />
          {userContext ? (
            <OfferDocumentsSection
              offer={offer}
              userContext={userContext}
              offerDocumentService={offerDocumentService}
              showToast={showToast}
            />
          ) : null}
        </div>
      ) : null}

      {tab === 'commission' && canViewCommission && userContext ? (
        <div role="tabpanel" id="offer-panel-commission" aria-labelledby="offer-tab-commission">
          <OfferCommissionSection
            offer={offer}
            userContext={userContext}
            commissionCalculationService={commissionCalculationService}
            showToast={showToast}
          />
        </div>
      ) : null}

      <Dialog
        isOpen={dialogMode === 'complete'}
        title="Angebot abschließen"
        onClose={() => setDialogMode(null)}
        secondaryAction={{ label: 'Abbrechen', onClick: () => setDialogMode(null) }}
        primaryAction={{ label: 'Angebot abschließen', onClick: handleComplete, loading: isActionRunning }}
      >
        <p>Das Angebot wird als abgeschlossen markiert und kann danach nicht mehr bearbeitet werden.</p>
      </Dialog>

      <Dialog
        isOpen={dialogMode === 'duplicate'}
        title="Angebot duplizieren"
        onClose={() => setDialogMode(null)}
        secondaryAction={{ label: 'Abbrechen', onClick: () => setDialogMode(null) }}
        primaryAction={{ label: 'Als Entwurf duplizieren', onClick: handleDuplicate, loading: isActionRunning }}
      >
        <p>Es wird ein neuer Entwurf mit denselben Inhalten angelegt.</p>
      </Dialog>

      <Dialog
        isOpen={dialogMode === 'cancel'}
        title="Angebot stornieren"
        onClose={() => setDialogMode(null)}
        secondaryAction={{ label: 'Abbrechen', onClick: () => setDialogMode(null) }}
        primaryAction={{ label: 'Angebot stornieren', onClick: handleCancel, loading: isActionRunning }}
      >
        <p>Das Angebot wird storniert und kann danach nicht mehr bearbeitet werden.</p>
      </Dialog>
    </section>
  );
}
