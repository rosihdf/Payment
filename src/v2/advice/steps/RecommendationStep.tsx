import { useEffect, useRef } from 'react';
import type { BestPayComparisonSession } from '../../../domain/bestPayComparison/bestPayComparisonSession';
import { formatVariantComparisonLabel } from '../../../domain/bestPayComparison/costCaptureMode';
import { resolveSelectedScenarioVariant } from '../../../domain/bestPayComparison/salesWizard';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { formatEuro } from '../formatters';
import styles from '../AdviceWizard.module.css';

interface RecommendationStepProps {
  session: BestPayComparisonSession;
  busy: boolean;
  canSeeCommission: boolean;
  onCalculate: () => void;
  onSelectVariant: (scenarioId: string, candidateId: string) => void;
}

export function RecommendationStep({
  session,
  busy,
  canSeeCommission,
  onCalculate,
  onSelectVariant,
}: RecommendationStepProps) {
  const scenario =
    session.wizard.scenarios.find((entry) => entry.id === session.wizard.selectedScenarioId) ??
    session.wizard.scenarios[0] ??
    null;
  const result = scenario?.result ?? null;
  const selectedVariant = resolveSelectedScenarioVariant(scenario);
  const currentCosts = result?.currentMonthlyCostsCents ?? null;
  const primaryVariant =
    result?.variants.find((variant) => variant.candidateId === result.primaryCandidateId) ??
    result?.variants[0] ??
    null;
  const alternatives =
    result?.variants.filter((variant) => variant.candidateId !== primaryVariant?.candidateId) ?? [];

  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current || result || busy) {
      return;
    }
    autoStartedRef.current = true;
    onCalculate();
  }, [busy, onCalculate, result]);

  return (
    <div className={styles.stack}>
      <article className={styles.hero}>
        <h2 className={styles.sectionTitle}>Empfehlung</h2>
        <p className={styles.hint}>
          {result
            ? 'Hauptempfehlung und Alternativen auf Basis von Bedarf und Ist-Kosten.'
            : 'Empfehlung wird aus den erfassten Angaben berechnet…'}
        </p>
        {result ? (
          <Button variant="secondary" loading={busy} onClick={onCalculate}>
            Empfehlung aktualisieren
          </Button>
        ) : (
          <Button loading={busy} onClick={onCalculate}>
            Empfehlung berechnen
          </Button>
        )}
      </article>

      {result && primaryVariant ? (
        <>
          <article className={styles.card}>
            <div className={styles.recommendationHeader}>
              <h3 className={styles.sectionTitle}>Hauptempfehlung</h3>
              <StatusBadge variant="success" label="Empfohlen" />
            </div>
            <p className={styles.recommendationTitle}>{primaryVariant.tariffName}</p>
            <p className={styles.hint}>
              {formatVariantComparisonLabel(primaryVariant, currentCosts)} ·{' '}
              {formatEuro(primaryVariant.monthlyTotalCostsCents)} / Monat
            </p>
            {canSeeCommission && primaryVariant.commissionTotalCents !== null ? (
              <p className={styles.hint}>
                Provision intern: {formatEuro(primaryVariant.commissionTotalCents)}
              </p>
            ) : null}
            {primaryVariant.primaryReasons.length > 0 ? (
              <>
                <h4 className={styles.subheading}>Begründung</h4>
                <ul className={styles.reasonList}>
                  {primaryVariant.primaryReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {scenario && selectedVariant?.candidateId !== primaryVariant.candidateId ? (
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => onSelectVariant(scenario.id, primaryVariant.candidateId)}
              >
                Hauptempfehlung übernehmen
              </Button>
            ) : null}
          </article>

          {alternatives.length > 0 ? (
            <article className={styles.card}>
              <h3 className={styles.sectionTitle}>Alternativen</h3>
              <ul className={styles.variantList}>
                {alternatives.map((variant) => {
                  const isSelected = scenario?.selectedCandidateId === variant.candidateId;
                  return (
                    <li key={variant.candidateId}>
                      <button
                        type="button"
                        className={isSelected ? styles.variantSelected : styles.variantItem}
                        disabled={busy || !scenario}
                        onClick={() => scenario && onSelectVariant(scenario.id, variant.candidateId)}
                      >
                        <strong>{variant.tariffName}</strong>
                        <span className={styles.hint}>
                          {formatVariantComparisonLabel(variant, currentCosts)}
                        </span>
                        {canSeeCommission && variant.commissionTotalCents !== null ? (
                          <span className={styles.hint}>
                            Provision intern: {formatEuro(variant.commissionTotalCents)}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </article>
          ) : null}

          {selectedVariant ? (
            <p className={styles.hint}>
              Gewählt: {selectedVariant.tariffName}. Mit „Weiter“ zum Angebot.
            </p>
          ) : (
            <p className={styles.hint}>Bitte eine Variante auswählen, um fortzufahren.</p>
          )}
        </>
      ) : null}
    </div>
  );
}
