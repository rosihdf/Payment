import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState } from '../../components/feedback/EmptyState';
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
        title="Rechner"
        subtitle="BestPay-Vergleich und Konditionsrechner für den Außendienst"
        actions={
          <button type="button" className={styles.resetButton} onClick={handleReset}>
            Eingaben zurücksetzen
          </button>
        }
      />

      <div className={styles.hubGrid}>
        <article className={styles.hubCard}>
          <h2 className={styles.hubTitle}>BestPay-Vergleich</h2>
          <p className={styles.hubText}>
            Aktuelle Zahlungsverkehrskosten erfassen, BestPay-Varianten vergleichen und eine
            Empfehlung berechnen.
          </p>
          <div className={styles.hubActions}>
            <Link className={styles.hubPrimary} to="/calculator/bestpay?mode=billing&new=1">
              Abrechnung einlesen
            </Link>
            <Link className={styles.hubSecondary} to="/calculator/bestpay?mode=manual&new=1">
              Werte manuell eingeben
            </Link>
            <Link className={styles.hubSecondary} to="/calculator/bestpay/history">
              Gespeicherte Berechnungen
            </Link>
          </div>
        </article>
      </div>

      <h2 className={styles.sectionHeading}>Konditionsvergleich</h2>
      <p className={styles.sectionHint}>
        Bisherige Payment-Kosten manuell mit einem aktiven BestPay-Tarif vergleichen.
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
