import type { FormEvent } from 'react';
import { CurrencyInput } from '../../components/common/CurrencyInput';
import { FormControl } from '../../components/common/FormControl';
import { FormField, textareaClassName } from '../../components/common/FormField';
import { NumberInput } from '../../components/common/NumberInput';
import { PercentageTenthsRateInput } from '../../components/common/PercentageTenthsRateInput';
import { TenthsCurrencyInput } from '../../components/common/TenthsCurrencyInput';
import type { CardRateKey, CreateTariffInput, TariffFormMode } from '../../domain/tariff/tariff';
import {
  BILLING_INTERVAL_LABELS,
  BILLING_INTERVAL_OPTIONS,
  CARD_RATE_KEYS,
  CARD_RATE_LABELS,
  TARIFF_STATUS_LABELS,
  TARIFF_STATUS_OPTIONS,
} from '../../domain/tariff/tariff';
import type { CreateTariffErrors } from '../../services/tariffValidation';
import { TerminalTypeSelector } from './TerminalTypeSelector';
import styles from './TariffForm.module.css';

interface TariffFormProps {
  mode: TariffFormMode;
  values: CreateTariffInput;
  errors: CreateTariffErrors;
  isSubmitting: boolean;
  onChange: (values: CreateTariffInput) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function TariffForm({
  mode,
  values,
  errors,
  isSubmitting,
  onChange,
  onSubmit,
  onCancel,
}: TariffFormProps) {
  const updateField = <K extends keyof CreateTariffInput>(
    field: K,
    value: CreateTariffInput[K],
  ) => {
    onChange({ ...values, [field]: value });
  };

  const updateCardRate = (
    key: CardRateKey,
    field: keyof CreateTariffInput['cardRates'][CardRateKey],
    value: number,
  ) => {
    onChange({
      ...values,
      cardRates: {
        ...values.cardRates,
        [key]: {
          ...values.cardRates[key],
          [field]: value,
        },
      },
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const submitLabel = mode === 'create' ? 'Tarif speichern' : 'Änderungen speichern';
  const submittingLabel = mode === 'create' ? 'Tarif wird angelegt…' : 'Änderungen werden gespeichert…';

  return (
    <form
      className={styles.form}
      aria-label={mode === 'create' ? 'Tarif anlegen' : 'Tarif bearbeiten'}
      onSubmit={handleSubmit}
      noValidate
    >
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Tarifidentität</h2>
        <div className={styles.grid}>
          <FormControl type="text" id="name" label="Tarifname" required error={errors.name} value={values.name} disabled={isSubmitting} onChange={(event) => updateField('name', event.target.value)} />
          <FormControl type="text" id="providerName" label="Anbietername" required error={errors.providerName} value={values.providerName} disabled={isSubmitting} onChange={(event) => updateField('providerName', event.target.value)} />
          <FormControl type="text" id="productCode" label="Produktcode (intern)" required error={errors.productCode} value={values.productCode} disabled={isSubmitting} onChange={(event) => updateField('productCode', event.target.value)} />
          <FormControl type="select" id="status" label="Status" required error={errors.status}
              value={values.status}
              disabled={isSubmitting}
              onChange={(event) => updateField('status', event.target.value as CreateTariffInput['status'])}
            >
              {TARIFF_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {TARIFF_STATUS_LABELS[status]}
                </option>
              ))}
            </FormControl>
          <div className={styles.fullWidth}>
            <FormField id="description" label="Beschreibung" error={errors.description}>
              <textarea
                id="description"
                className={textareaClassName(errors.description)}
                value={values.description}
                aria-invalid={Boolean(errors.description)}
                disabled={isSubmitting}
                onChange={(event) => updateField('description', event.target.value)}
              />
            </FormField>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Einsatzarten</h2>
        <TerminalTypeSelector
          value={values.supportedTerminalTypes}
          onChange={(supportedTerminalTypes) => updateField('supportedTerminalTypes', supportedTerminalTypes)}
          error={errors.supportedTerminalTypes}
          disabled={isSubmitting}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Monatliche Grundkosten</h2>
        <div className={styles.grid}>
          <CurrencyInput
            id="monthlyAccountBaseFeeCents"
            label="Grundgebühr je Vertrag"
            value={values.monthlyAccountBaseFeeCents}
            error={errors.monthlyAccountBaseFeeCents}
            disabled={isSubmitting}
            onChange={(value) => updateField('monthlyAccountBaseFeeCents', value ?? 0)}
          />
          <CurrencyInput
            id="monthlyTerminalRentalCents"
            label="Terminalmiete je Terminal"
            value={values.monthlyTerminalRentalCents}
            error={errors.monthlyTerminalRentalCents}
            disabled={isSubmitting}
            onChange={(value) => updateField('monthlyTerminalRentalCents', value ?? 0)}
          />
          <CurrencyInput
            id="monthlyServiceFeePerTerminalCents"
            label="Servicepauschale je Terminal"
            value={values.monthlyServiceFeePerTerminalCents}
            error={errors.monthlyServiceFeePerTerminalCents}
            disabled={isSubmitting}
            onChange={(value) => updateField('monthlyServiceFeePerTerminalCents', value ?? 0)}
          />
          <CurrencyInput
            id="setupFeeCents"
            label="Einmalige Einrichtungsgebühr"
            value={values.setupFeeCents}
            error={errors.setupFeeCents}
            disabled={isSubmitting}
            onChange={(value) => updateField('setupFeeCents', value ?? 0)}
          />
          <CurrencyInput
            id="minimumMonthlyFeeCents"
            label="Monatliches Mindestentgelt"
            value={values.minimumMonthlyFeeCents}
            error={errors.minimumMonthlyFeeCents}
            disabled={isSubmitting}
            onChange={(value) => updateField('minimumMonthlyFeeCents', value)}
          />
          <FormControl type="select" id="billingInterval" label="Abrechnungsintervall" error={errors.billingInterval}
              value={values.billingInterval}
              disabled={isSubmitting}
              onChange={(event) =>
                updateField('billingInterval', event.target.value as CreateTariffInput['billingInterval'])
              }
            >
              {BILLING_INTERVAL_OPTIONS.map((interval) => (
                <option key={interval} value={interval}>
                  {BILLING_INTERVAL_LABELS[interval]}
                </option>
              ))}
            </FormControl>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Transaktionen</h2>
        <div className={styles.grid}>
          <NumberInput
            id="includedTransactions"
            label="Enthaltene Transaktionen"
            value={values.includedTransactions}
            error={errors.includedTransactions}
            disabled={isSubmitting}
            placeholder="Keine Angabe"
            onChange={(value) => updateField('includedTransactions', value)}
          />
          <TenthsCurrencyInput
            id="additionalTransactionFeeTenthsOfCent"
            label="Transaktionspreis"
            value={values.additionalTransactionFeeTenthsOfCent}
            error={errors.additionalTransactionFeeTenthsOfCent}
            disabled={isSubmitting}
            onChange={(value) => updateField('additionalTransactionFeeTenthsOfCent', value)}
          />
          <TenthsCurrencyInput
            id="girocardClearingFeeTenthsOfCent"
            label="Clearing je Girocard-Transaktion"
            value={values.girocardClearingFeeTenthsOfCent}
            error={errors.girocardClearingFeeTenthsOfCent}
            disabled={isSubmitting || values.girocardClearingIncluded}
            onChange={(value) => updateField('girocardClearingFeeTenthsOfCent', value)}
          />
          <FormField id="girocardClearingIncluded" label="Clearing inklusive">
            <label className={styles.checkboxLabel}>
              <input
                id="girocardClearingIncluded"
                type="checkbox"
                checked={values.girocardClearingIncluded}
                disabled={isSubmitting}
                onChange={(event) => {
                  const included = event.target.checked;
                  onChange({
                    ...values,
                    girocardClearingIncluded: included,
                    girocardClearingFeeTenthsOfCent: included
                      ? 0
                      : values.girocardClearingFeeTenthsOfCent,
                  });
                }}
              />
              Clearing je Girocard-Transaktion ist im Tarif enthalten
            </label>
          </FormField>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Kartenentgelte</h2>
        <div className={styles.grid}>
          {CARD_RATE_KEYS.map((key) => (
            <div key={key} className={`${styles.cardRateGroup} ${styles.fullWidth}`}>
              <h3 className={styles.cardRateTitle}>{CARD_RATE_LABELS[key]}</h3>
              <div className={styles.grid}>
                <PercentageTenthsRateInput
                  id={`cardRates-${key}-percentage`}
                  label="Prozententgelt"
                  value={values.cardRates[key].percentageTenthsOfBasisPoint}
                  error={errors[`cardRates.${key}`]}
                  disabled={isSubmitting}
                  onChange={(percentageTenthsOfBasisPoint) =>
                    updateCardRate(key, 'percentageTenthsOfBasisPoint', percentageTenthsOfBasisPoint)
                  }
                />
                <TenthsCurrencyInput
                  id={`cardRates-${key}-fixed`}
                  label="Fixes Entgelt je Transaktion"
                  value={values.cardRates[key].fixedFeeTenthsOfCent}
                  disabled={isSubmitting}
                  onChange={(fixedFeeTenthsOfCent) =>
                    updateCardRate(key, 'fixedFeeTenthsOfCent', fixedFeeTenthsOfCent)
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Vertragsbedingungen</h2>
        <div className={styles.grid}>
          <NumberInput
            id="minimumContractMonths"
            label="Mindestvertragslaufzeit in Monaten"
            value={values.minimumContractMonths}
            error={errors.minimumContractMonths}
            disabled={isSubmitting}
            placeholder="Keine Angabe"
            onChange={(value) => updateField('minimumContractMonths', value)}
          />
          <NumberInput
            id="noticePeriodMonths"
            label="Kündigungsfrist in Monaten"
            value={values.noticePeriodMonths}
            error={errors.noticePeriodMonths}
            disabled={isSubmitting}
            placeholder="Keine Angabe"
            onChange={(value) => updateField('noticePeriodMonths', value)}
          />
          <FormControl type="date" id="validFrom" label="Gültig ab" error={errors.validFrom} value={values.validFrom ?? ''} disabled={isSubmitting} onChange={(event) => updateField('validFrom', event.target.value || null)} />
          <FormControl type="date" id="validUntil" label="Gültig bis" error={errors.validUntil} value={values.validUntil ?? ''} disabled={isSubmitting} onChange={(event) => updateField('validUntil', event.target.value || null)} />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Interne Hinweise</h2>
        <FormField id="notes" label="Interne Notizen" error={errors.notes}>
          <textarea
            id="notes"
            className={textareaClassName(errors.notes)}
            value={values.notes}
            aria-invalid={Boolean(errors.notes)}
            disabled={isSubmitting}
            onChange={(event) => updateField('notes', event.target.value)}
          />
        </FormField>
      </section>

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
        <button type="button" className={styles.secondary} disabled={isSubmitting} onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
