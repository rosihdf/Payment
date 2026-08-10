import { useCallback, useEffect, useState } from 'react';
import { FormControl } from '../../components/common/FormControl';
import { FormField, textareaClassName } from '../../components/common/FormField';
import type { Offer } from '../../domain/offer/offer';
import {
  buildOfferFrozenCommissionDisplay,
  type OfferFrozenCommissionDisplay,
} from '../../domain/offer/offerFrozenCommissionDisplay';
import { isFrozenCommercialSnapshot } from '../../domain/offer/offerCommercialSnapshot';
import {
  OFFER_EMPTY_COMMISSION_SNAPSHOT_HINT,
  OFFER_LEGACY_COMMISSION_HINT,
} from '../../domain/offer/offerDetailCopy';
import type { OfferUserContext } from '../../services/offerService';
import type { CommissionCalculationService } from '../../services/commissionCalculationService';
import type {
  AdminCommissionCalculationView,
  SalesCommissionCalculationView,
} from '../../services/commissionCalculationViews';
import { displayDateTime } from '../../utils/format';
import { formatOptionalCents } from '../../utils/formatTariff';
import styles from './OfferCommissionSection.module.css';

interface OfferCommissionSectionProps {
  offer: Offer;
  userContext: OfferUserContext;
  commissionCalculationService: CommissionCalculationService;
  contractTypeCode?: string | null;
  showToast: (message: string, variant: 'success' | 'error') => void;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function FrozenCommissionView({ display }: { display: OfferFrozenCommissionDisplay }) {
  return (
    <>
      <span className={`${styles.statusBadge} ${styles.statusStandard}`}>{display.statusLabel}</span>
      <p className={styles.hint}>{display.sourceLabel}</p>
      <dl className={styles.grid}>
        {display.commissionPlanKindLabel ? (
          <DetailRow label="Provisionsmodell" value={display.commissionPlanKindLabel} />
        ) : null}
        {display.contractConfigurationLabel ? (
          <DetailRow label="Vertragskonstellation" value={display.contractConfigurationLabel} />
        ) : null}
        {display.contractTermMonths ? (
          <DetailRow label="Laufzeit" value={`${display.contractTermMonths} Monate`} />
        ) : null}
        <DetailRow
          label="Einmalige Provision"
          value={formatOptionalCents(display.oneTimeCommissionAmountCents)}
        />
        <DetailRow
          label="Zubehörprovision"
          value={formatOptionalCents(display.accessoryCommissionAmountCents)}
        />
        {display.recurringComponents.length > 0 ? (
          <DetailRow
            label="Laufende Bestandteile"
            value={display.recurringComponents
              .map(
                (entry) =>
                  `${entry.label}: ${formatOptionalCents(entry.amountCents)}${
                    entry.isProvisional ? ' (vorläufig)' : ''
                  }`,
              )
              .join(' · ')}
          />
        ) : null}
        <DetailRow
          label="Erwartete Gesamtprovision"
          value={formatOptionalCents(display.finalExpectedCommissionAmountCents)}
        />
        <DetailRow label="Berechnet am" value={displayDateTime(display.calculatedAt)} />
      </dl>
      {display.provisionalRecurringHint ? (
        <p className={styles.hint}>{display.provisionalRecurringHint}</p>
      ) : null}
      <p className={styles.hint}>
        Die endgültige Provision steht erst nach Adminfreigabe fest. Dies ist keine Auszahlungszusage.
      </p>
    </>
  );
}

export function OfferCommissionSection({
  offer,
  userContext,
  commissionCalculationService,
  contractTypeCode = 'terminal_plus_acq',
  showToast,
}: OfferCommissionSectionProps) {
  const frozenDisplay =
    isFrozenCommercialSnapshot(offer.commercialSnapshot) && offer.commercialSnapshot.commission
      ? buildOfferFrozenCommissionDisplay(offer.commercialSnapshot)
      : null;
  const isLegacyCommissionPath = !frozenDisplay;

  const [salesView, setSalesView] = useState<SalesCommissionCalculationView | null>(null);
  const [adminView, setAdminView] = useState<AdminCommissionCalculationView | null>(null);
  const [isLoading, setIsLoading] = useState(isLegacyCommissionPath);
  const [isCalculating, setIsCalculating] = useState(false);
  const [reductionAmount, setReductionAmount] = useState('');
  const [reductionReason, setReductionReason] = useState('');
  const [reductionError, setReductionError] = useState<string | undefined>();

  const loadLegacyCommission = useCallback(async () => {
    if (!isLegacyCommissionPath) {
      return;
    }
    setIsLoading(true);
    const sales = await commissionCalculationService.getSalesViewForOffer(offer.id, userContext);
    setSalesView(sales);

    if (userContext.role === 'admin') {
      const admin = await commissionCalculationService.getAdminViewForOffer(offer.id, userContext);
      setAdminView(admin);
      if (admin?.reductionDecision?.proposedReductionAmountCents) {
        setReductionAmount(String(admin.reductionDecision.proposedReductionAmountCents / 100));
      }
    } else {
      setAdminView(null);
    }

    setIsLoading(false);
  }, [commissionCalculationService, isLegacyCommissionPath, offer.id, userContext]);

  useEffect(() => {
    void loadLegacyCommission();
  }, [loadLegacyCommission]);

  const handleRecalculatePreview = () => {
    void (async () => {
      setIsCalculating(true);
      const result = await commissionCalculationService.calculatePreviewForOffer(
        offer.id,
        userContext,
        contractTypeCode,
      );

      if (result.ok) {
        showToast('Provisionsvorschau wurde aktualisiert', 'success');
        await loadLegacyCommission();
      } else if (result.error === 'pricing_missing' || result.error === 'pricing_stale') {
        showToast('Bitte zuerst eine aktuelle Preisbewertung durchführen.', 'error');
      } else if (result.error === 'frozen') {
        showToast('Für abgeschlossene Angebote ist nur eine Prüfung ohne Snapshot-Änderung möglich.', 'error');
      } else {
        showToast('Provisionsvorschau konnte nicht berechnet werden', 'error');
      }

      setIsCalculating(false);
    })();
  };

  const handleSaveReduction = () => {
    if (userContext.role !== 'admin' || frozenDisplay) {
      return;
    }

    const cents = Math.round(Number(reductionAmount.replace(',', '.')) * 100);
    if (Number.isNaN(cents)) {
      setReductionError('Bitte geben Sie einen gültigen Betrag ein.');
      return;
    }

    void (async () => {
      const result = await commissionCalculationService.saveReductionDecision(
        offer.id,
        userContext,
        cents,
        reductionReason,
      );

      if (result.ok) {
        showToast('Kürzungsentscheidung gespeichert', 'success');
        setReductionError(undefined);
        await loadLegacyCommission();
      } else if (result.error === 'exceeds_limit') {
        setReductionError('Die Kürzung überschreitet die maximal zulässige Grenze von 50 Prozent.');
        showToast('Kürzung überschreitet die zulässige Grenze', 'error');
      } else if (result.error === 'reason_required') {
        setReductionError('Bitte geben Sie eine Begründung an.');
      } else {
        showToast('Kürzungsentscheidung konnte nicht gespeichert werden', 'error');
      }
    })();
  };

  const canExplicitRecalculate = offer.status === 'draft' || userContext.role === 'admin';

  if (frozenDisplay) {
    return (
      <section className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Provision</h2>
        <FrozenCommissionView display={frozenDisplay} />
      </section>
    );
  }

  return (
    <section className={styles.detailSection}>
      <h2 className={styles.sectionTitle}>Provision</h2>
      {isLegacyCommissionPath ? (
        <p className={styles.hint}>{OFFER_LEGACY_COMMISSION_HINT}</p>
      ) : null}

      {isLoading ? (
        <p className={styles.emptyHint}>Provisionsvorschau wird geladen…</p>
      ) : !salesView ? (
        <>
          <p className={styles.emptyHint}>
            {isFrozenCommercialSnapshot(offer.commercialSnapshot)
              ? OFFER_EMPTY_COMMISSION_SNAPSHOT_HINT
              : 'Für dieses Angebot liegt noch keine Provisionsvorschau vor.'}
          </p>
          {canExplicitRecalculate && offer.status === 'draft' ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryAction}
                disabled={isCalculating}
                onClick={handleRecalculatePreview}
              >
                Provisionsvorschau berechnen
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <span
            className={`${styles.statusBadge} ${
              salesView.stale
                ? styles.statusStale
                : salesView.calculationBlocked
                  ? styles.statusCritical
                  : salesView.isPreview
                    ? styles.statusAttention
                    : styles.statusStandard
            }`}
          >
            {salesView.statusLabel}
          </span>

          <dl className={styles.grid}>
            <DetailRow
              label="Einmalige erwartete Provision"
              value={formatOptionalCents(salesView.oneTimeCommissionAmountCents)}
            />
            <DetailRow
              label="Zubehörprovision"
              value={formatOptionalCents(salesView.accessoryCommissionAmountCents)}
            />
            <DetailRow
              label="Erwartete Gesamtprovision"
              value={formatOptionalCents(salesView.finalExpectedCommissionAmountCents)}
            />
          </dl>

          {salesView.provisionalRecurringHint ? (
            <p className={styles.hint}>{salesView.provisionalRecurringHint}</p>
          ) : null}

          {salesView.reductionReviewRequired ? (
            <p className={styles.hint}>
              Mögliche Provisionskürzung – endgültige Entscheidung durch Admin erforderlich.
            </p>
          ) : null}

          <p className={styles.hint}>
            Die endgültige Provision steht erst nach Adminfreigabe fest. Dies ist keine Auszahlungszusage.
          </p>

          {salesView.actionableFindings.length > 0 ? (
            <ul className={styles.findingList}>
              {salesView.actionableFindings.map((finding) => (
                <li key={finding.code} className={styles.findingItem}>
                  {finding.salesDescription}
                </li>
              ))}
            </ul>
          ) : null}

          {userContext.role === 'admin' && adminView && offer.status === 'draft' ? (
            <div className={styles.adminGrid}>
              <DetailRow
                label="Planversion"
                value={
                  adminView.commissionPlanVersionNumber !== null
                    ? `V${adminView.commissionPlanVersionNumber}`
                    : 'Keine gültige Zuordnung'
                }
              />
              <DetailRow
                label="Ursprüngliche Provision"
                value={formatOptionalCents(adminView.originalCommissionAmountCents)}
              />
              <DetailRow
                label="Maximal zulässige Kürzung"
                value={formatOptionalCents(
                  adminView.reductionDecision?.maxAllowedReductionAmountCents ?? null,
                )}
              />
              <DetailRow
                label="Vorgeschlagene Kürzung"
                value={formatOptionalCents(adminView.proposedReductionAmountCents)}
              />
              <DetailRow
                label="Verbleibende Provision"
                value={formatOptionalCents(adminView.finalExpectedCommissionAmountCents)}
              />

              {adminView.reductionReviewRequired ? (
                <div className={styles.reductionForm}>
                  <FormControl
                    id="reductionAmount"
                    type="text"
                    label="Kürzungsbetrag (EUR)"
                    error={reductionError}
                    value={reductionAmount}
                    onChange={(event) => {
                      setReductionAmount(event.target.value);
                      setReductionError(undefined);
                    }}
                  />
                  <FormField id="reductionReason" label="Begründung" required>
                    <textarea
                      id="reductionReason"
                      className={textareaClassName()}
                      value={reductionReason}
                      onChange={(event) => setReductionReason(event.target.value)}
                    />
                  </FormField>
                  <button type="button" className={styles.secondaryAction} onClick={handleSaveReduction}>
                    Kürzungsentscheidung speichern
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {canExplicitRecalculate && offer.status === 'draft' ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryAction}
                disabled={isCalculating}
                onClick={handleRecalculatePreview}
              >
                {salesView.stale ? 'Provision neu prüfen' : 'Vorschau aktualisieren'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
