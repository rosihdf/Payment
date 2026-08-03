import type { BestPayComparisonSession } from '../../../domain/bestPayComparison/bestPayComparisonSession';
import { formatVariantComparisonLabel } from '../../../domain/bestPayComparison/costCaptureMode';
import { resolveSelectedScenarioVariant } from '../../../domain/bestPayComparison/salesWizard';
import { Button } from '../../ui/Button';
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
  const selectedVariant = resolveSelectedScenarioVariant(scenario);
  const currentCosts = scenario?.result?.currentMonthlyCostsCents ?? null;

  return (
    <div className={styles.stack}>
      <article className={styles.hero}>
        <h2 className={styles.sectionTitle}>Empfehlung</h2>
        <p className={styles.hint}>
          Eine klare Hauptempfehlung mit nachvollziehbarer Begründung.
        </p>
        <Button loading={busy} onClick={onCalculate}>
          Empfehlung berechnen
        </Button>
      </article>

      {scenario?.result ? (
        <article className={styles.card}>
          <h3 className={styles.sectionTitle}>Varianten</h3>
          <ul className={styles.variantList}>
            {scenario.result.variants.map((variant) => {
              const isSelected = scenario.selectedCandidateId === variant.candidateId;
              const isPrimary = variant.candidateId === scenario.result?.primaryCandidateId;
              return (
                <li key={variant.candidateId}>
                  <button
                    type="button"
                    className={isSelected ? styles.variantSelected : styles.variantItem}
                    disabled={busy}
                    onClick={() => onSelectVariant(scenario.id, variant.candidateId)}
                  >
                    <strong>
                      {variant.tariffName}
                      {isPrimary ? ' · Hauptempfehlung' : ''}
                    </strong>
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
          {selectedVariant ? (
            <p className={styles.hint}>
              Gewählt: {selectedVariant.tariffName} · {formatEuro(selectedVariant.monthlyTotalCostsCents)} / Monat
            </p>
          ) : (
            <p className={styles.hint}>Bitte eine Variante auswählen.</p>
          )}
        </article>
      ) : (
        <article className={styles.card}>
          <p className={styles.hint}>Noch keine Empfehlung berechnet.</p>
        </article>
      )}
    </div>
  );
}
