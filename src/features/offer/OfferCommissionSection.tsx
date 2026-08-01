import { useCallback, useEffect, useState } from 'react';
import { FormControl } from '../../components/common/FormControl';
import { FormField, textareaClassName } from '../../components/common/FormField';
import type { Offer } from '../../domain/offer/offer';
import type { OfferUserContext } from '../../services/offerService';
import type { CommissionCalculationService } from '../../services/commissionCalculationService';
import type {
  AdminCommissionCalculationView,
  SalesCommissionCalculationView,
} from '../../services/commissionCalculationViews';
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

export function OfferCommissionSection({
  offer,
  userContext,
  commissionCalculationService,
  contractTypeCode = 'terminal_plus_acq',
  showToast,
}: OfferCommissionSectionProps) {
  const [salesView, setSalesView] = useState<SalesCommissionCalculationView | null>(null);
  const [adminView, setAdminView] = useState<AdminCommissionCalculationView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [reductionAmount, setReductionAmount] = useState('');
  const [reductionReason, setReductionReason] = useState('');
  const [reductionError, setReductionError] = useState<string | undefined>();

  const loadCommission = useCallback(async () => {
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
  }, [commissionCalculationService, offer.id, userContext]);

  useEffect(() => {
    void loadCommission();
  }, [loadCommission]);

  const handleCalculate = () => {
    void (async () => {
      setIsCalculating(true);
      const result = await commissionCalculationService.calculatePreviewForOffer(
        offer.id,
        userContext,
        contractTypeCode,
      );

      if (result.ok) {
        showToast('Provisionsvorschau wurde aktualisiert', 'success');
        await loadCommission();
      } else if (result.error === 'pricing_missing' || result.error === 'pricing_stale') {
        showToast('Bitte zuerst eine aktuelle Preisbewertung durchführen.', 'error');
      } else {
        showToast('Provisionsvorschau konnte nicht berechnet werden', 'error');
      }

      setIsCalculating(false);
    })();
  };

  const handleSaveReduction = () => {
    if (userContext.role !== 'admin') {
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
        await loadCommission();
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

  const canCalculate = offer.status === 'draft';

  return (
    <section className={styles.detailSection}>
      <h2 className={styles.sectionTitle}>Provision</h2>

      {isLoading ? (
        <p className={styles.emptyHint}>Provisionsvorschau wird geladen…</p>
      ) : !salesView ? (
        <>
          <p className={styles.emptyHint}>
            Für dieses Angebot liegt noch keine Provisionsvorschau vor. Eine endgültige Provision
            entsteht erst nach Adminfreigabe.
          </p>
          {canCalculate ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryAction}
                disabled={isCalculating}
                onClick={handleCalculate}
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
            Die endgültige Provision steht erst nach Adminfreigabe fest. Dies ist keine
            Auszahlungszusage.
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

          {userContext.role === 'admin' && adminView ? (
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

          {canCalculate ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryAction}
                disabled={isCalculating}
                onClick={handleCalculate}
              >
                {salesView.stale ? 'Neu berechnen' : 'Vorschau aktualisieren'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
