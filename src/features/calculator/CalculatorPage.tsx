import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import { ADVICE_PATH } from '../../utils/routes';
import { DEFAULT_CURRENT_PAYMENT_CONDITIONS } from '../../domain/calculator/comparisonDefaults';
import { mapTariffToBestPayComparisonConditions } from '../../domain/calculator/comparisonMapping';
import type { CurrentPaymentConditions } from '../../domain/calculator/comparison';
import type { Tariff } from '../../domain/tariff/tariff';
import { useServices } from '../../hooks/useServices';
import { calculatePaymentComparison } from '../../services/paymentComparisonService';
import {
  hasValidationErrors,
  validateCurrentPaymentConditions,
  validateTariffSelection,
  type PaymentComparisonValidationErrors,
} from '../../services/paymentComparisonValidation';
import { BestPayOfferPanel } from './BestPayOfferPanel';
import { ComparisonCostBreakdownCard } from './ComparisonCostBreakdownCard';
import { ComparisonResultsOverview } from './ComparisonResultsOverview';
import { CurrentConditionsForm } from './CurrentConditionsForm';
import styles from './CalculatorPage.module.css';

/**
 * Untergeordnete „Schnelle Berechnung“ – nutzt die vorhandene einfache Vergleichslogik.
 * Vollständige Beratung: /advice
 */
export function CalculatorPage() {
  const { tariffService } = useServices();
  const [activeTariffs, setActiveTariffs] = useState<Tariff[]>([]);
  const [isLoadingTariffs, setIsLoadingTariffs] = useState(true);
  const [currentConditions, setCurrentConditions] = useState<CurrentPaymentConditions>(
    DEFAULT_CURRENT_PAYMENT_CONDITIONS,
  );
  const [selectedTariffId, setSelectedTariffId] = useState<string | null>(null);
  const [tariffUnavailableMessage, setTariffUnavailableMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsLoadingTariffs(true);
    void tariffService.getActiveTariffs().then((tariffs) => {
      const sorted = [...tariffs].sort((left, right) => left.name.localeCompare(right.name, 'de'));
      setActiveTariffs(sorted);
      setIsLoadingTariffs(false);
    });
  }, [tariffService]);

  useEffect(() => {
    if (activeTariffs.length === 0) {
      setSelectedTariffId(null);
      return;
    }

    if (selectedTariffId && activeTariffs.some((tariff) => tariff.id === selectedTariffId)) {
      return;
    }

    if (selectedTariffId) {
      setTariffUnavailableMessage(
        'Der zuvor gewählte Tarif ist nicht mehr aktiv und wurde zurückgesetzt.',
      );
    }

    setSelectedTariffId(activeTariffs[0]?.id ?? null);
  }, [activeTariffs, selectedTariffId]);

  const selectedTariff = activeTariffs.find((tariff) => tariff.id === selectedTariffId) ?? null;

  const bestPayConditions = useMemo(
    () => (selectedTariff ? mapTariffToBestPayComparisonConditions(selectedTariff) : null),
    [selectedTariff],
  );

  const validationErrors: PaymentComparisonValidationErrors = useMemo(() => {
    const inputErrors = validateCurrentPaymentConditions(currentConditions);
    const tariffErrors = validateTariffSelection(
      selectedTariffId,
      activeTariffs.map((tariff) => tariff.id),
    );

    return { ...inputErrors, ...tariffErrors };
  }, [activeTariffs, currentConditions, selectedTariffId]);

  const comparisonResult = useMemo(() => {
    if (hasValidationErrors(validationErrors) || !bestPayConditions) {
      return null;
    }

    return calculatePaymentComparison(currentConditions, bestPayConditions);
  }, [bestPayConditions, currentConditions, validationErrors]);

  const handleReset = () => {
    setCurrentConditions(DEFAULT_CURRENT_PAYMENT_CONDITIONS);
    setSelectedTariffId(activeTariffs[0]?.id ?? null);
    setTariffUnavailableMessage(null);
  };

  return (
    <section>
      <PageHeader
        title="Schnelle Berechnung"
        subtitle="Unverbindliche Tarifberechnung ohne vollständigen Beratungsprozess."
        actions={
          <div className={styles.headerActions}>
            <Link className={styles.hubSecondary} to={ADVICE_PATH}>
              Zur Beratung
            </Link>
            <button type="button" className={styles.resetButton} onClick={handleReset}>
              Eingaben zurücksetzen
            </button>
          </div>
        }
      />

      <p className={styles.sectionHint}>
        Reduzierte Variante des Kostenvergleichs. Für Abrechnungseinlesen, Empfehlung und Angebot
        bitte den Beratungsweg nutzen.
      </p>

      {tariffUnavailableMessage ? (
        <p className={styles.notice} role="status">
          {tariffUnavailableMessage}
        </p>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.columns}>
          <CurrentConditionsForm
            values={currentConditions}
            errors={validationErrors}
            onChange={setCurrentConditions}
          />

          {isLoadingTariffs ? (
            <article className={styles.loadingPanel}>
              <EmptyState
                title="Tarife werden geladen"
                description="Aktive BestPay-Tarife werden vorbereitet."
              />
            </article>
          ) : (
            <BestPayOfferPanel
              tariffs={activeTariffs}
              selectedTariffId={selectedTariffId}
              bestPayConditions={bestPayConditions}
              tariffError={validationErrors.tariffId}
              onTariffChange={(tariffId) => {
                setTariffUnavailableMessage(null);
                setSelectedTariffId(tariffId);
              }}
            />
          )}
        </div>

        {comparisonResult ? (
          <>
            <ComparisonResultsOverview result={comparisonResult} />
            <div className={styles.breakdownColumns}>
              <ComparisonCostBreakdownCard
                title="Bisherige Kosten"
                breakdown={comparisonResult.current}
              />
              <ComparisonCostBreakdownCard
                title="BestPay-Kosten"
                breakdown={comparisonResult.bestPay}
                showFixedCostDetails
              />
            </div>
          </>
        ) : (
          <section className={styles.invalidResult} aria-label="Vergleichsergebnis">
            <EmptyState
              title="Vergleich noch nicht verfügbar"
              description="Bitte prüfen Sie die Eingaben und wählen Sie einen aktiven BestPay-Tarif."
            />
          </section>
        )}
      </div>
    </section>
  );
}
