import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import type { Contract } from '../../domain/contract/contract';
import type { Offer } from '../../domain/offer/offer';
import { calculateOfferTotals } from '../../domain/offer/offerCalculations';
import { isFrozenCommercialSnapshot } from '../../domain/offer/offerCommercialSnapshot';
import {
  OFFER_LEGACY_UNFROZEN_HINT,
  OFFER_EMPTY_POSITIONS_LEGACY_HINT,
  OFFER_PROJECTION_SOURCE_LABEL,
} from '../../domain/offer/offerDetailCopy';
import { resolveOfferCommercialLegacyStatus } from '../../domain/offer/normalizeOfferCommercialSnapshot';
import { isEditableWorkflowStatus } from '../../domain/offer/offerWorkflow';
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
import { OfferFulfillmentCard } from '../../features/offer/OfferFulfillmentCard';
import { OfferCustomerFeedbackSection } from '../../features/offer/OfferCustomerFeedbackSection';
import { OfferCustomerShareSection } from '../../features/offer/OfferCustomerShareSection';
import { OfferWorkflowSection } from '../../features/offer/OfferWorkflowSection';
import { canCancelOfferWorkflow } from '../../domain/offer/offerDraftDeletion';
import {
  getOfferPrimaryStatusBadgeVariant,
  getOfferPrimaryStatusLabel,
  getOfferWorkflowTechnicalLabel,
} from '../../features/offer/offerWorkflowDisplay';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import { textareaClassName } from '../ui/FormField';
import styles from './OfferDetailPage.module.css';

const OfferBillingImportSection = lazy(async () => {
  const module = await import('../../features/offer/OfferBillingImportSection');
  return { default: module.OfferBillingImportSection };
});

type DialogMode = 'complete' | 'cancel' | 'duplicate' | 'delete' | null;
type TabId = 'overview' | 'conditions' | 'handoff' | 'documents' | 'commission';

function resolveOfferDetailTab(value: string | null): TabId {
  switch (value) {
    case 'positions':
    case 'conditions':
      return 'conditions';
    case 'workflow':
    case 'handoff':
      return 'handoff';
    case 'versions':
    case 'documents':
      return 'documents';
    case 'commission':
      return 'commission';
    default:
      return 'overview';
  }
}

const DEPLOYMENT_MODE_LABELS = {
  stationary_wifi: 'Stationär (WLAN)',
  mobile_sim: 'Mobil (SIM)',
} as const;

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
  const initialTab = resolveOfferDetailTab(searchParams.get('tab'));
  const [tab, setTab] = useState<TabId>(initialTab);

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

  // Zugriff bereits über getOfferById geprüft – Edit nur noch statusabhängig.
  const canEdit = offer ? isEditableWorkflowStatus(offer.workflowStatus) : false;
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

  const handleDeleteDraft = () => {
    if (!offer || !userContext) {
      return;
    }

    void (async () => {
      setIsActionRunning(true);
      const result = await offerService.deleteDraftOffer(offer.id, userContext);

      if (result.ok) {
        showToast('Entwurf wurde gelöscht', 'success');
        navigate('/offers');
      } else if ('message' in result && result.message) {
        showToast(result.message, 'error');
      } else {
        showToast('Entwurf konnte nicht gelöscht werden', 'error');
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
  const frozenCommercial = isFrozenCommercialSnapshot(offer.commercialSnapshot)
    ? offer.commercialSnapshot
    : null;
  const commercialLegacyStatus = resolveOfferCommercialLegacyStatus(offer.commercialSnapshot);
  const contactName = formatContactName(
    offer.customerSnapshot.contactFirstName,
    offer.customerSnapshot.contactLastName,
  );
  const showTechnical = currentUser?.role === 'admin';
  const primaryStatusLabel = getOfferPrimaryStatusLabel(offer.workflowStatus);
  const canCancel = canCancelOfferWorkflow(offer.workflowStatus) && offer.status !== 'cancelled';
  const canDeleteDraft = showTechnical && offer.workflowStatus === 'draft';

  const monthlyDisplayCents = frozenCommercial?.projection.monthlyTotalCents ?? totals.monthlyTotalCents;
  const oneTimeDisplayCents =
    frozenCommercial?.projection.oneTimeTotalCents ?? totals.oneTimeTotalCents;

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'conditions', label: 'Konditionen' },
    { id: 'handoff', label: 'Kundenvorlage' },
    { id: 'documents', label: 'Dokumente' },
  ];
  if (canViewCommission) {
    tabs.push({ id: 'commission', label: 'Provision' });
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
                <Button variant="secondary">Zum Kunden</Button>
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
          variant={getOfferPrimaryStatusBadgeVariant(offer.workflowStatus)}
          label={primaryStatusLabel}
        />
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
          <h2 className={styles.sectionTitle}>Angebotszusammenfassung</h2>
          <dl className={styles.grid}>
            <DetailRow label="Angebotsnummer" value={offer.offerNumber} />
            <DetailRow label="Kunde" value={displayText(offer.customerSnapshot.companyName)} />
            <DetailRow label="Status" value={primaryStatusLabel} />
            <DetailRow
              label="Tarif"
              value={displayText(frozenCommercial?.identity.tariffName ?? offer.tariffSnapshot?.name ?? null)}
            />
            <DetailRow
              label="Laufzeit"
              value={formatOptionalMonths(
                frozenCommercial?.identity.contractTermMonths ??
                  offer.tariffSnapshot?.contractDurationMonths ??
                  null,
              )}
            />
            <DetailRow
              label="Einsatzart"
              value={
                frozenCommercial
                  ? DEPLOYMENT_MODE_LABELS[frozenCommercial.identity.deploymentMode]
                  : offer.tariffSnapshot
                    ? TERMINAL_TYPE_LABELS[offer.tariffSnapshot.terminalType]
                    : '—'
              }
            />
            <DetailRow
              label="Monatliche Prognose"
              value={`${formatOptionalCents(monthlyDisplayCents)} / Monat`}
            />
            <DetailRow
              label="Einmalige Kosten"
              value={formatOptionalCents(oneTimeDisplayCents)}
            />
            <DetailRow label="Ansprechpartner" value={displayText(contactName)} />
            <DetailRow label="Gültig bis" value={displayDateTime(offer.validUntil)} />
            {showTechnical ? (
              <DetailRow
                label="Workflow-Status (intern)"
                value={getOfferWorkflowTechnicalLabel(offer.workflowStatus)}
              />
            ) : null}
            {offer.completedAt ? (
              <DetailRow label="Abgeschlossen am" value={displayDateTime(offer.completedAt)} />
            ) : null}
          </dl>

          {['accepted', 'activation_pending', 'activated', 'released', 'accounted', 'paid'].includes(
            offer.workflowStatus,
          ) ? (
            <OfferFulfillmentCard offer={offer} contract={linkedContract} onUpdated={loadOffer} />
          ) : null}

          {linkedContract ? (
            <p className={styles.sectionHint}>
              <Link className={styles.inlineLink} to={`/contracts/${linkedContract.id}`}>
                Zum Vertrag
              </Link>
            </p>
          ) : null}

          {canCancel ? (
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

          {canDeleteDraft ? (
            <div className={styles.moreActions}>
              <h3 className={styles.sectionTitle}>Entwurf entfernen</h3>
              <p className={styles.sectionHint}>
                Nur echte Entwürfe ohne Vertrag, Dokumente oder Folgeprozesse können endgültig gelöscht werden.
              </p>
              <Button
                variant="secondary"
                disabled={isActionRunning}
                onClick={() => setDialogMode('delete')}
              >
                Entwurf löschen
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'conditions' ? (
        <div
          className={styles.detailSection}
          role="tabpanel"
          id="offer-panel-conditions"
          aria-labelledby="offer-tab-conditions"
        >
          <h2 className={styles.sectionTitle}>Konditionen</h2>
          {commercialLegacyStatus === 'legacy_unfrozen' ? (
            <p className={styles.sectionHint}>{OFFER_LEGACY_UNFROZEN_HINT}</p>
          ) : null}
          {offer.tariffSnapshot ? (
            <dl className={styles.grid}>
              <DetailRow
                label="Tarif"
                value={displayText(frozenCommercial?.identity.tariffName ?? offer.tariffSnapshot.name)}
              />
              <DetailRow label="Anbieter" value={displayText(offer.tariffSnapshot.providerName)} />
              <DetailRow
                label="Einsatzart"
                value={
                  frozenCommercial
                    ? DEPLOYMENT_MODE_LABELS[frozenCommercial.identity.deploymentMode]
                    : TERMINAL_TYPE_LABELS[offer.tariffSnapshot.terminalType]
                }
              />
              <DetailRow
                label="Monatliche Fixkosten"
                value={
                  frozenCommercial
                    ? `${formatOptionalCents(frozenCommercial.projection.breakdown.monthlyFixedTotalCents)} / Monat`
                    : `${formatOptionalCents(totals.tariffMonthlyFixedTotalCents)} / Monat`
                }
              />
              <DetailRow
                label="Variable Konditionen (Prognose)"
                value={
                  frozenCommercial
                    ? `${formatOptionalCents(frozenCommercial.projection.breakdown.monthlyVariableTotalCents)} / Monat`
                    : '—'
                }
              />
              <DetailRow
                label="Einrichtungsgebühr"
                value={
                  frozenCommercial
                    ? `${formatOptionalCents(frozenCommercial.projection.breakdown.oneTimeSetupCents)} einmalig`
                    : `${formatOptionalCents(offer.tariffSnapshot.setupFeeCents)} einmalig`
                }
              />
              <DetailRow
                label="Girocard"
                value={formatCardRate({
                  percentageTenthsOfBasisPoint:
                    frozenCommercial?.commercialConfig.cardRates.girocard.percentageTenthsOfBasisPoint ??
                    offer.tariffSnapshot.girocardRateTenthsOfBasisPoint,
                  fixedFeeTenthsOfCent: 0,
                })}
              />
              <DetailRow
                label="Girocard-Clearing"
                value={formatGirocardClearing(
                  frozenCommercial?.commercialConfig.girocardClearingIncluded ??
                    offer.tariffSnapshot.girocardClearingIncluded,
                  frozenCommercial?.commercialConfig.girocardClearingFeeTenthsOfCent ??
                    offer.tariffSnapshot.girocardClearingFeeTenthsOfCent,
                )}
              />
              <DetailRow
                label="Vertragslaufzeit"
                value={formatOptionalMonths(
                  frozenCommercial?.identity.contractTermMonths ??
                    offer.tariffSnapshot.contractDurationMonths,
                )}
              />
              {frozenCommercial ? (
                <DetailRow
                  label="Prognose Gesamt / Monat"
                  value={`${formatOptionalCents(frozenCommercial.projection.monthlyTotalCents)} (${OFFER_PROJECTION_SOURCE_LABEL})`}
                />
              ) : null}
            </dl>
          ) : (
            <p className={styles.emptyHint}>Kein Payment-Tarif verknüpft.</p>
          )}

          <h3 className={styles.sectionTitle}>Positionen</h3>
          {offer.items.length === 0 ? (
            <p className={styles.emptyHint}>
              {commercialLegacyStatus === 'legacy_unfrozen'
                ? OFFER_EMPTY_POSITIONS_LEGACY_HINT
                : 'Keine Positionen vorhanden.'}
            </p>
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
            {showTechnical ? (
              <DetailRow label="Interne Hinweise" value={displayText(offer.internalNotes)} />
            ) : null}
          </dl>
        </div>
      ) : null}

      {tab === 'handoff' ? (
        <div role="tabpanel" id="offer-panel-handoff" aria-labelledby="offer-tab-handoff">
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

      {tab === 'documents' ? (
        <div role="tabpanel" id="offer-panel-documents" aria-labelledby="offer-tab-documents">
          {userContext ? (
            <OfferDocumentsSection
              offer={offer}
              userContext={userContext}
              offerDocumentService={offerDocumentService}
              showToast={showToast}
            />
          ) : null}
          <OfferWorkflowSection
            offer={offer}
            onUpdated={loadOffer}
            mode="versions"
            hideHeaderBadge
            hideNextActionBanner
          />
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

      <Dialog
        isOpen={dialogMode === 'delete'}
        title="Entwurf löschen"
        onClose={() => setDialogMode(null)}
        secondaryAction={{ label: 'Abbrechen', onClick: () => setDialogMode(null) }}
        primaryAction={{
          label: 'Endgültig löschen',
          variant: 'destructive',
          onClick: handleDeleteDraft,
          loading: isActionRunning,
        }}
      >
        <p>
          Entwurf {offer.offerNumber} unwiderruflich löschen? Nur echte Entwürfe ohne Folgedaten sind erlaubt.
        </p>
      </Dialog>
    </section>
  );
}
