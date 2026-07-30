import { useCallback, useEffect, useState } from 'react';
import type { Offer } from '../../domain/offer/offer';
import type { PricingReviewClass } from '../../domain/pricing/pricingFinding';
import type { OfferUserContext } from '../../services/offerService';
import type { PricingEvaluationService } from '../../services/pricingEvaluationService';
import type {
  AdminPricingEvaluationView,
  SalesPricingEvaluationView,
} from '../../services/pricingEvaluationViews';
import { formatOptionalCents } from '../../utils/formatTariff';
import styles from './OfferPricingEvaluationSection.module.css';

interface OfferPricingEvaluationSectionProps {
  offer: Offer;
  userContext: OfferUserContext;
  pricingEvaluationService: PricingEvaluationService;
  showToast: (message: string, variant: 'success' | 'error') => void;
}

function reviewClassStyle(reviewClass: PricingReviewClass, stale: boolean): string {
  if (stale) {
    return styles.statusStale ?? '';
  }

  if (reviewClass === 'attention') {
    return styles.statusAttention ?? '';
  }

  if (reviewClass === 'critical') {
    return styles.statusCritical ?? '';
  }

  return styles.statusStandard ?? '';
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function OfferPricingEvaluationSection({
  offer,
  userContext,
  pricingEvaluationService,
  showToast,
}: OfferPricingEvaluationSectionProps) {
  const [salesView, setSalesView] = useState<SalesPricingEvaluationView | null>(null);
  const [adminView, setAdminView] = useState<AdminPricingEvaluationView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const loadEvaluation = useCallback(async () => {
    setIsLoading(true);

    const sales = await pricingEvaluationService.getSalesViewForOffer(offer.id, userContext);
    setSalesView(sales);

    if (userContext.role === 'admin') {
      const admin = await pricingEvaluationService.getAdminViewForOffer(offer.id, userContext);
      setAdminView(admin);
    } else {
      setAdminView(null);
    }

    setIsLoading(false);
  }, [offer.id, pricingEvaluationService, userContext]);

  useEffect(() => {
    void loadEvaluation();
  }, [loadEvaluation]);

  const handleEvaluate = () => {
    void (async () => {
      setIsEvaluating(true);
      const result = await pricingEvaluationService.evaluateOffer(offer.id, userContext);

      if (result.ok) {
        showToast('Preisbewertung wurde aktualisiert', 'success');
        await loadEvaluation();
      } else if ('errors' in result) {
        showToast('Preisbewertung konnte nicht berechnet werden – bitte Eingaben prüfen.', 'error');
      } else if (result.error === 'frozen') {
        showToast('Entwürfe außerhalb des Entwurfsstatus können nicht neu bewertet werden.', 'error');
      } else {
        showToast('Preisbewertung konnte nicht berechnet werden', 'error');
      }

      setIsEvaluating(false);
    })();
  };

  const canEvaluate = offer.status === 'draft';

  return (
    <section className={styles.detailSection}>
      <h2 className={styles.sectionTitle}>Preis- und Freigabeprüfung</h2>

      {isLoading ? (
        <p className={styles.emptyHint}>Bewertung wird geladen…</p>
      ) : !salesView ? (
        <>
          <p className={styles.emptyHint}>
            Für dieses Angebot liegt noch keine interne Preisbewertung vor.
          </p>
          {canEvaluate ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryAction}
                disabled={isEvaluating}
                onClick={handleEvaluate}
              >
                Preisbewertung berechnen
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <span
            className={`${styles.statusBadge} ${reviewClassStyle(salesView.reviewClass, salesView.stale)}`}
          >
            {salesView.stale ? 'Bewertung veraltet' : salesView.reviewClassLabel}
          </span>

          <dl className={styles.grid}>
            <DetailRow
              label="Empfohlener Preis"
              value={formatOptionalCents(salesView.recommendedPriceCents)}
            />
            <DetailRow
              label="Gewählter Preis"
              value={formatOptionalCents(salesView.requestedPriceCents)}
            />
            <DetailRow label="Laufzeit" value={
              salesView.termMonths !== null ? `${salesView.termMonths} Monate` : 'Keine Angabe'
            } />
            <DetailRow label="Laufzeitstatus" value={salesView.termStatusLabel} />
          </dl>

          {salesView.actionableFindings.length > 0 ? (
            <ul className={styles.findingList}>
              {salesView.actionableFindings.map((finding) => (
                <li key={`${finding.code}-${finding.field ?? 'general'}`} className={styles.findingItem}>
                  {finding.salesDescription}
                  {finding.requiredAction ? ` (${finding.requiredAction})` : ''}
                </li>
              ))}
            </ul>
          ) : null}

          {userContext.role === 'admin' && adminView ? (
            <div className={styles.adminGrid}>
              <DetailRow
                label="Listenpreis"
                value={formatOptionalCents(adminView.listPriceCents)}
              />
              <DetailRow
                label="Zielpreis"
                value={formatOptionalCents(adminView.targetPriceCents)}
              />
              <DetailRow
                label="Mindestpreis"
                value={formatOptionalCents(adminView.minimumPriceCents)}
              />
              <DetailRow
                label="Preislistenversion"
                value={
                  adminView.priceBookVersionNumber !== null
                    ? `V${adminView.priceBookVersionNumber}`
                    : 'Keine gültige Version'
                }
              />
              <DetailRow
                label="Angewendete Regeln"
                value={
                  adminView.appliedRules.length > 0
                    ? adminView.appliedRules.map((rule) => rule.name).join(', ')
                    : 'Keine'
                }
              />
              <DetailRow
                label="Schnellprüfung möglich"
                value={adminView.approval.quickReviewPossible ? 'Ja' : 'Nein'}
              />
              <DetailRow
                label="Detailprüfung erforderlich"
                value={adminView.approval.detailReviewRequired ? 'Ja' : 'Nein'}
              />
              <DetailRow
                label="Freigabe blockiert"
                value={adminView.approval.approvalBlocked ? 'Ja' : 'Nein'}
              />
            </div>
          ) : null}

          {canEvaluate ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryAction}
                disabled={isEvaluating}
                onClick={handleEvaluate}
              >
                {salesView.stale ? 'Neu berechnen' : 'Bewertung aktualisieren'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
