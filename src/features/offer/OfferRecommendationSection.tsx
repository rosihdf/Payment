import { useCallback, useEffect, useState } from 'react';
import type { Offer } from '../../domain/offer/offer';
import type { OfferUserContext } from '../../services/offerService';
import type { RecommendationService } from '../../services/recommendationService';
import type {
  AdminRecommendationView,
  SalesRecommendationView,
} from '../../services/recommendationViews';
import { formatOptionalCents } from '../../utils/formatTariff';
import styles from './OfferRecommendationSection.module.css';

interface OfferRecommendationSectionProps {
  offer: Offer;
  userContext: OfferUserContext;
  recommendationService: RecommendationService;
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

export function OfferRecommendationSection({
  offer,
  userContext,
  recommendationService,
  showToast,
}: OfferRecommendationSectionProps) {
  const [salesView, setSalesView] = useState<SalesRecommendationView | null>(null);
  const [adminView, setAdminView] = useState<AdminRecommendationView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [deviationReason, setDeviationReason] = useState('');
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null);

  const loadRecommendation = useCallback(async () => {
    setIsLoading(true);
    const sales = await recommendationService.getSalesViewForOffer(offer.id, userContext);
    setSalesView(sales);

    if (userContext.role === 'admin') {
      const admin = await recommendationService.getAdminViewForOffer(offer.id, userContext);
      setAdminView(admin);
    } else {
      setAdminView(null);
    }

    setIsLoading(false);
  }, [offer.id, recommendationService, userContext]);

  useEffect(() => {
    void loadRecommendation();
  }, [loadRecommendation]);

  const handleCalculate = () => {
    void (async () => {
      setIsCalculating(true);
      const result = await recommendationService.calculateForOffer(offer.id, userContext);

      if (result.ok) {
        showToast('BestPay-Empfehlung wurde berechnet', 'success');
        await loadRecommendation();
      } else if (result.error === 'frozen') {
        showToast('Entwürfe außerhalb des Entwurfsstatus können nicht neu berechnet werden.', 'error');
      } else {
        showToast('Empfehlung konnte nicht berechnet werden', 'error');
      }

      setIsCalculating(false);
    })();
  };

  const handleApply = (candidateId: string, selectionType: 'primary' | 'alternative') => {
    void (async () => {
      setIsApplying(true);
      const result = await recommendationService.applyCandidateSelection(
        offer.id,
        candidateId,
        userContext,
        {
          selectionType,
          deviationReason,
        },
      );

      if (result.ok) {
        showToast('BestPay-Konfiguration wurde übernommen', 'success');
        setPendingCandidateId(null);
        setDeviationReason('');
        await loadRecommendation();
      } else if (result.error === 'stale') {
        showToast('Die Empfehlung ist veraltet – bitte neu berechnen.', 'error');
      } else if (result.error === 'validation') {
        showToast('Bitte prüfen Sie die Auswahl und Begründung.', 'error');
      } else {
        showToast('Übernahme nicht möglich', 'error');
      }

      setIsApplying(false);
    })();
  };

  const canCalculate = offer.status === 'draft';

  return (
    <section className={styles.detailSection}>
      <h2 className={styles.sectionTitle}>BestPay-Empfehlung</h2>

      {isLoading ? (
        <p className={styles.emptyHint}>Empfehlung wird geladen…</p>
      ) : !salesView ? (
        <p className={styles.emptyHint}>Keine Empfehlungsdaten verfügbar.</p>
      ) : (
        <>
          {salesView.stale ? (
            <span className={styles.statusStale}>Empfehlung veraltet – Eingaben oder Katalog haben sich geändert</span>
          ) : null}

          {!salesView.primary ? (
            <>
              <p className={styles.emptyHint}>
                {salesView.needComplete
                  ? 'Für dieses Angebot liegt noch keine BestPay-Empfehlung vor.'
                  : `Bedarf unvollständig${salesView.missingNeedFields.length > 0 ? `: ${salesView.missingNeedFields.join(', ')}` : ''}.`}
              </p>
              {canCalculate ? (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.primaryAction}
                    disabled={isCalculating}
                    onClick={handleCalculate}
                  >
                    Empfehlung berechnen
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Primärempfehlung</h3>
                <p className={styles.cardMeta}>{salesView.primary.label}</p>
                <DetailRow label="Laufzeit" value={`${salesView.primary.termMonths ?? '—'} Monate`} />
                <DetailRow label="Hardware" value={salesView.primary.hardwareLabel} />
                <DetailRow
                  label="Monatliche Fixkosten"
                  value={formatOptionalCents(salesView.primary.monthlyFixedCostsCents)}
                />
                <DetailRow
                  label="Prognose Gesamtkosten"
                  value={
                    salesView.primary.costProjectionComplete
                      ? formatOptionalCents(salesView.primary.totalCostsCents)
                      : 'Unvollständig – Vergleich eingeschränkt'
                  }
                />
                <DetailRow label="Prüfstatus" value={salesView.primary.reviewClass} />
                {salesView.primary.reasons.length > 0 ? (
                  <ul className={styles.reasonList}>
                    {salesView.primary.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
                {salesView.canApplySelection ? (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.primaryAction}
                      disabled={isApplying}
                      onClick={() => handleApply(salesView.primary!.candidateId, 'primary')}
                    >
                      Empfehlung übernehmen
                    </button>
                  </div>
                ) : null}
              </div>

              {salesView.costBaselineComparison ? (
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>Ist-Kosten vs. BestPay (Primärempfehlung)</h3>
                  <DetailRow
                    label="Aktuelle Ø Monatskosten"
                    value={salesView.costBaselineComparison.currentMonthlyCostsLabel}
                  />
                  <DetailRow
                    label="BestPay Ø Monatskosten"
                    value={salesView.costBaselineComparison.bestPayMonthlyCostsLabel}
                  />
                  <DetailRow
                    label="Monatliche Differenz"
                    value={salesView.costBaselineComparison.monthlyDifferenceLabel}
                  />
                  {salesView.costBaselineComparison.monthlySavingsLabel ? (
                    <DetailRow
                      label="Mögliche Einsparung / Monat"
                      value={salesView.costBaselineComparison.monthlySavingsLabel}
                    />
                  ) : null}
                  {salesView.costBaselineComparison.monthlyAdditionalCostsLabel ? (
                    <DetailRow
                      label="Mögliche Mehrkosten / Monat"
                      value={salesView.costBaselineComparison.monthlyAdditionalCostsLabel}
                    />
                  ) : null}
                  {salesView.costBaselineComparison.paybackMonths !== null ? (
                    <DetailRow
                      label="Amortisation (Monate)"
                      value={String(salesView.costBaselineComparison.paybackMonths)}
                    />
                  ) : null}
                  {!salesView.costBaselineComparison.isFullyComparable ? (
                    <p className={styles.emptyHint}>
                      Vergleich eingeschränkt – Datenqualität:{' '}
                      {salesView.costBaselineComparison.dataQuality}
                      {salesView.costBaselineComparison.missingBasis.length > 0
                        ? ` (${salesView.costBaselineComparison.missingBasis.join(', ')})`
                        : ''}
                    </p>
                  ) : null}
                  {salesView.costBaselineComparison.isProjected ? (
                    <p className={styles.emptyHint}>
                      Prognose basierend auf bestätigten Abrechnungen – künftige Nutzung kann abweichen.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {salesView.alternatives.length > 0 ? (
                <div className={styles.alternativeList}>
                  <h3 className={styles.cardTitle}>Alternativen</h3>
                  {salesView.alternatives.map((alternative) => (
                    <div key={alternative.candidateId} className={styles.card}>
                      <p className={styles.cardMeta}>{alternative.label}</p>
                      <DetailRow label="Unterschied" value={alternative.mainDifference} />
                      {alternative.costDifferenceCents !== null ? (
                        <DetailRow
                          label="Kostenunterschied"
                          value={formatOptionalCents(alternative.costDifferenceCents)}
                        />
                      ) : null}
                      {salesView.canApplySelection ? (
                        <>
                          <div className={styles.actions}>
                            <button
                              type="button"
                              className={styles.secondaryAction}
                              disabled={isApplying}
                              onClick={() => {
                                setPendingCandidateId(alternative.candidateId);
                              }}
                            >
                              Alternative wählen
                            </button>
                          </div>
                          {pendingCandidateId === alternative.candidateId ? (
                            <div className={styles.deviationField}>
                              <label htmlFor={`deviation-${alternative.candidateId}`}>
                                Begründung für Abweichung
                              </label>
                              <textarea
                                id={`deviation-${alternative.candidateId}`}
                                value={deviationReason}
                                onChange={(event) => setDeviationReason(event.target.value)}
                              />
                              <button
                                type="button"
                                className={styles.primaryAction}
                                disabled={isApplying || !deviationReason.trim()}
                                onClick={() =>
                                  handleApply(alternative.candidateId, 'alternative')
                                }
                              >
                                Alternative übernehmen
                              </button>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {canCalculate ? (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    disabled={isCalculating}
                    onClick={handleCalculate}
                  >
                    Empfehlung neu berechnen
                  </button>
                </div>
              ) : null}
            </>
          )}

          {salesView.findings.length > 0 ? (
            <ul className={styles.reasonList}>
              {salesView.findings.map((finding) => (
                <li key={finding.code}>{finding.salesDescription}</li>
              ))}
            </ul>
          ) : null}

          {adminView ? (
            <div className={styles.adminBlock}>
              <h3 className={styles.cardTitle}>Admin-Analyse</h3>
              <DetailRow label="Fingerprint" value={adminView.inputFingerprint || '—'} />
              <DetailRow label="Gewichtung" value={adminView.weightSetLabel} />
              <DetailRow
                label="Bewertete Kandidaten"
                value={String(adminView.rankedCandidates.length)}
              />
              <DetailRow
                label="Blockiert"
                value={String(adminView.blockedCandidates.length)}
              />
              <DetailRow
                label="Ausgeschlossen"
                value={String(adminView.excludedCandidates.length)}
              />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
