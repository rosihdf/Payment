import { CurrencyInput } from '../../components/common/CurrencyInput';
import { NumberInput } from '../../components/common/NumberInput';
import { PercentageTenthsRateInput } from '../../components/common/PercentageTenthsRateInput';
import { TenthsCurrencyInput } from '../../components/common/TenthsCurrencyInput';
import type { CurrentPaymentConditions } from '../../domain/calculator/comparison';
import type { PaymentComparisonValidationErrors } from '../../services/paymentComparisonValidation';
import styles from './CurrentConditionsForm.module.css';

interface CurrentConditionsFormProps {
  values: CurrentPaymentConditions;
  errors: PaymentComparisonValidationErrors;
  onChange: (values: CurrentPaymentConditions) => void;
}

export function CurrentConditionsForm({
  values,
  errors,
  onChange,
}: CurrentConditionsFormProps) {
  const updateField = <K extends keyof CurrentPaymentConditions>(
    field: K,
    value: CurrentPaymentConditions[K],
  ) => {
    onChange({ ...values, [field]: value });
  };

  return (
    <article className={styles.panel}>
      <h2 className={styles.panelTitle}>Bisheriger Vertrag</h2>
      <p className={styles.panelDescription}>
        Aktuelle Konditionen des bestehenden Payment-Vertrags des Interessenten.
      </p>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Vertrag und Terminal</h3>
        <div className={styles.grid}>
          <NumberInput
            id="terminalCount"
            label="Anzahl angemieteter Terminals"
            value={values.terminalCount}
            error={errors.terminalCount}
            required
            min={1}
            onChange={(value) => updateField('terminalCount', value ?? 1)}
          />
          <NumberInput
            id="contractDurationYears"
            label="Vertragslaufzeit in Jahren"
            value={values.contractDurationYears}
            error={errors.contractDurationYears}
            required
            min={1}
            onChange={(value) => updateField('contractDurationYears', value ?? 1)}
          />
          <CurrencyInput
            id="terminalRentalPerUnitCents"
            label="Mietkosten je Terminal monatlich"
            value={values.terminalRentalPerUnitCents}
            error={errors.terminalRentalPerUnitCents}
            required
            onChange={(value) => updateField('terminalRentalPerUnitCents', value ?? 0)}
          />
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Transaktionen</h3>
        <div className={styles.grid}>
          <TenthsCurrencyInput
            id="transactionFeeTenthsOfCent"
            label="Transaktionspreis"
            value={values.transactionFeeTenthsOfCent}
            error={errors.transactionFeeTenthsOfCent}
            required
            onChange={(value) => updateField('transactionFeeTenthsOfCent', value)}
          />
          <NumberInput
            id="girocardTransactionCountMonthly"
            label="Girocard-Transaktionen monatlich"
            value={values.girocardTransactionCountMonthly}
            error={errors.girocardTransactionCountMonthly}
            onChange={(value) => updateField('girocardTransactionCountMonthly', value ?? 0)}
          />
          <NumberInput
            id="acquiringTransactionCountMonthly"
            label="Mastercard/Visa/Maestro/VPAY monatlich"
            value={values.acquiringTransactionCountMonthly}
            error={errors.acquiringTransactionCountMonthly}
            onChange={(value) => updateField('acquiringTransactionCountMonthly', value ?? 0)}
          />
          <TenthsCurrencyInput
            id="girocardClearingFeeTenthsOfCent"
            label="Clearing je Girocard-Transaktion"
            value={values.girocardClearingFeeTenthsOfCent}
            error={errors.girocardClearingFeeTenthsOfCent}
            onChange={(value) => updateField('girocardClearingFeeTenthsOfCent', value)}
          />
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Kartenumsätze</h3>
        <div className={styles.grid}>
          <PercentageTenthsRateInput
            id="girocardRateTenthsOfBasisPoint"
            label="Girocard-Netzserviceentgelt"
            value={values.girocardRateTenthsOfBasisPoint}
            error={errors.girocardRateTenthsOfBasisPoint}
            onChange={(value) => updateField('girocardRateTenthsOfBasisPoint', value)}
          />
          <CurrencyInput
            id="girocardVolumeMonthlyCents"
            label="Girocard-Volumen monatlich"
            value={values.girocardVolumeMonthlyCents}
            error={errors.girocardVolumeMonthlyCents}
            onChange={(value) => updateField('girocardVolumeMonthlyCents', value ?? 0)}
          />
          <PercentageTenthsRateInput
            id="creditCardRateTenthsOfBasisPoint"
            label="Mastercard-/Visa-Kondition"
            value={values.creditCardRateTenthsOfBasisPoint}
            error={errors.creditCardRateTenthsOfBasisPoint}
            onChange={(value) => updateField('creditCardRateTenthsOfBasisPoint', value)}
          />
          <CurrencyInput
            id="creditCardVolumeMonthlyCents"
            label="Mastercard-/Visa-Volumen monatlich"
            value={values.creditCardVolumeMonthlyCents}
            error={errors.creditCardVolumeMonthlyCents}
            onChange={(value) => updateField('creditCardVolumeMonthlyCents', value ?? 0)}
          />
          <PercentageTenthsRateInput
            id="debitCardRateTenthsOfBasisPoint"
            label="Maestro-/VPAY-Kondition"
            value={values.debitCardRateTenthsOfBasisPoint}
            error={errors.debitCardRateTenthsOfBasisPoint}
            onChange={(value) => updateField('debitCardRateTenthsOfBasisPoint', value)}
          />
          <CurrencyInput
            id="debitCardVolumeMonthlyCents"
            label="Maestro-/VPAY-Volumen monatlich"
            value={values.debitCardVolumeMonthlyCents}
            error={errors.debitCardVolumeMonthlyCents}
            onChange={(value) => updateField('debitCardVolumeMonthlyCents', value ?? 0)}
          />
        </div>
      </section>
    </article>
  );
}
