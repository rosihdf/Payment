import type { FormEvent } from 'react';
import { CheckboxField } from '../../components/common/CheckboxField';
import { CurrencyInput } from '../../components/common/CurrencyInput';
import { FormField } from '../../components/common/FormField';
import { NumberInput } from '../../components/common/NumberInput';
import { PercentageInput } from '../../components/common/PercentageInput';
import type { CreateLeadInput, EditLeadInput } from '../../domain/lead/lead';
import {
  LEAD_INTEREST_LABELS,
  LEAD_INTEREST_OPTIONS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_OPTIONS,
  PAYMENT_USAGE_LABELS,
} from '../../domain/lead/lead';
import type { CreateLeadErrors } from '../../services/leadValidation';
import styles from './LeadForm.module.css';

interface LeadFormBaseProps {
  errors: CreateLeadErrors;
  cardMixSummary: string;
  isCardMixValid: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

interface CreateLeadFormProps extends LeadFormBaseProps {
  mode: 'create';
  values: CreateLeadInput;
  showDiscard: boolean;
  onChange: (values: CreateLeadInput) => void;
  onDiscard: () => void;
}

interface EditLeadFormProps extends LeadFormBaseProps {
  mode: 'edit';
  values: EditLeadInput;
  onChange: (values: EditLeadInput) => void;
}

export type LeadFormProps = CreateLeadFormProps | EditLeadFormProps;

export function LeadForm(props: LeadFormProps) {
  const {
    mode,
    values,
    errors,
    cardMixSummary,
    isCardMixValid,
    isSubmitting,
    onChange,
    onSubmit,
    onCancel,
  } = props;

  const updateField = <K extends keyof CreateLeadInput>(
    field: K,
    value: CreateLeadInput[K],
  ) => {
    handleChange({ ...values, [field]: value });
  };

  const handleChange = (next: CreateLeadInput | EditLeadInput) => {
    if (mode === 'edit') {
      (onChange as (values: EditLeadInput) => void)(next as EditLeadInput);
      return;
    }

    (onChange as (values: CreateLeadInput) => void)(next as CreateLeadInput);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const submitLabel = mode === 'create' ? 'Lead speichern' : 'Änderungen speichern';
  const submittingLabel = mode === 'create' ? 'Wird gespeichert…' : 'Wird gespeichert…';

  return (
    <form className={styles.form} aria-label="Lead-Erfassung" onSubmit={handleSubmit} noValidate>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Unternehmen und Ansprechpartner</h2>
        <div className={styles.grid}>
          <FormField id="companyName" label="Firmenname" required error={errors.companyName}>
            <input
              id="companyName"
              className={`${styles.input} ${errors.companyName ? styles.inputError : ''}`}
              value={values.companyName}
              aria-invalid={Boolean(errors.companyName)}
              disabled={isSubmitting}
              onChange={(event) => updateField('companyName', event.target.value)}
            />
          </FormField>
          <FormField id="industry" label="Branche" error={errors.industry}>
            <input
              id="industry"
              className={styles.input}
              value={values.industry}
              disabled={isSubmitting}
              onChange={(event) => updateField('industry', event.target.value)}
            />
          </FormField>
          <FormField id="contactFirstName" label="Vorname" required error={errors.contactFirstName}>
            <input
              id="contactFirstName"
              className={`${styles.input} ${errors.contactFirstName ? styles.inputError : ''}`}
              value={values.contactFirstName}
              aria-invalid={Boolean(errors.contactFirstName)}
              disabled={isSubmitting}
              onChange={(event) => updateField('contactFirstName', event.target.value)}
            />
          </FormField>
          <FormField id="contactLastName" label="Nachname" required error={errors.contactLastName}>
            <input
              id="contactLastName"
              className={`${styles.input} ${errors.contactLastName ? styles.inputError : ''}`}
              value={values.contactLastName}
              aria-invalid={Boolean(errors.contactLastName)}
              disabled={isSubmitting}
              onChange={(event) => updateField('contactLastName', event.target.value)}
            />
          </FormField>
          <FormField id="phone" label="Telefonnummer" required error={errors.phone}>
            <input
              id="phone"
              className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
              type="tel"
              value={values.phone}
              aria-invalid={Boolean(errors.phone)}
              disabled={isSubmitting}
              onChange={(event) => updateField('phone', event.target.value)}
            />
          </FormField>
          <FormField id="email" label="E-Mail" error={errors.email}>
            <input
              id="email"
              className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
              type="email"
              value={values.email}
              aria-invalid={Boolean(errors.email)}
              disabled={isSubmitting}
              onChange={(event) => updateField('email', event.target.value)}
            />
          </FormField>
          <FormField id="street" label="Straße" error={errors.street}>
            <input
              id="street"
              className={styles.input}
              value={values.street}
              disabled={isSubmitting}
              onChange={(event) => updateField('street', event.target.value)}
            />
          </FormField>
          <FormField id="postalCode" label="PLZ" error={errors.postalCode}>
            <input
              id="postalCode"
              className={`${styles.input} ${errors.postalCode ? styles.inputError : ''}`}
              inputMode="numeric"
              value={values.postalCode}
              aria-invalid={Boolean(errors.postalCode)}
              disabled={isSubmitting}
              onChange={(event) => updateField('postalCode', event.target.value)}
            />
          </FormField>
          <FormField id="city" label="Ort" error={errors.city}>
            <input
              id="city"
              className={styles.input}
              value={values.city}
              disabled={isSubmitting}
              onChange={(event) => updateField('city', event.target.value)}
            />
          </FormField>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Aktuelle Payment-Situation</h2>
        <div className={styles.grid}>
          <FormField id="currentProvider" label="Aktueller Payment-Anbieter" error={errors.currentProvider}>
            <input
              id="currentProvider"
              className={styles.input}
              value={values.currentProvider}
              disabled={isSubmitting}
              onChange={(event) => updateField('currentProvider', event.target.value)}
            />
          </FormField>
          <CurrencyInput
            id="monthlyCardTurnoverCents"
            label="Monatlicher Kartenumsatz"
            value={values.monthlyCardTurnoverCents}
            error={errors.monthlyCardTurnoverCents}
            disabled={isSubmitting}
            onChange={(value) => updateField('monthlyCardTurnoverCents', value)}
          />
          <NumberInput
            id="monthlyTransactions"
            label="Monatliche Transaktionen"
            value={values.monthlyTransactions}
            error={errors.monthlyTransactions}
            disabled={isSubmitting}
            onChange={(value) => updateField('monthlyTransactions', value)}
          />
          <CurrencyInput
            id="averageTransactionValueCents"
            label="Durchschnittlicher Bon"
            value={values.averageTransactionValueCents}
            error={errors.averageTransactionValueCents}
            disabled={isSubmitting}
            onChange={(value) => updateField('averageTransactionValueCents', value)}
          />
          <NumberInput
            id="currentTerminalCount"
            label="Anzahl aktuell eingesetzter Terminals"
            value={values.currentTerminalCount}
            error={errors.currentTerminalCount}
            disabled={isSubmitting}
            onChange={(value) => updateField('currentTerminalCount', value)}
          />
          <FormField id="currentTerminalModels" label="Vorhandene Terminalmodelle" error={errors.currentTerminalModels}>
            <input
              id="currentTerminalModels"
              className={styles.input}
              value={values.currentTerminalModels}
              disabled={isSubmitting}
              onChange={(event) => updateField('currentTerminalModels', event.target.value)}
            />
          </FormField>
          <FormField id="currentContractEndDate" label="Vertragsende" error={errors.currentContractEndDate}>
            <input
              id="currentContractEndDate"
              className={styles.input}
              type="date"
              value={values.currentContractEndDate ?? ''}
              disabled={isSubmitting}
              onChange={(event) =>
                updateField('currentContractEndDate', event.target.value || null)
              }
            />
          </FormField>
          <FormField id="currentNoticePeriod" label="Kündigungsfrist" error={errors.currentNoticePeriod}>
            <input
              id="currentNoticePeriod"
              className={styles.input}
              value={values.currentNoticePeriod}
              disabled={isSubmitting}
              onChange={(event) => updateField('currentNoticePeriod', event.target.value)}
            />
          </FormField>
        </div>
        <CheckboxField
          label="Payment-Nutzung"
          options={(
            Object.keys(PAYMENT_USAGE_LABELS) as Array<keyof CreateLeadInput['paymentUsage']>
          ).map((key) => ({
            id: `payment-${key}`,
            label: PAYMENT_USAGE_LABELS[key],
            checked: values.paymentUsage[key],
            onChange: (checked) =>
              handleChange({
                ...values,
                paymentUsage: { ...values.paymentUsage, [key]: checked },
              }),
          }))}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Kartenmix</h2>
        <div className={styles.grid}>
          <PercentageInput
            id="girocardPercent"
            label="Girocard in Prozent"
            value={values.cardMix.girocardPercent}
            disabled={isSubmitting}
            onChange={(value) =>
              handleChange({
                ...values,
                cardMix: { ...values.cardMix, girocardPercent: value },
              })
            }
          />
          <PercentageInput
            id="debitPercent"
            label="Debitkarten in Prozent"
            value={values.cardMix.debitPercent}
            disabled={isSubmitting}
            onChange={(value) =>
              handleChange({
                ...values,
                cardMix: { ...values.cardMix, debitPercent: value },
              })
            }
          />
          <PercentageInput
            id="creditPercent"
            label="Kreditkarten in Prozent"
            value={values.cardMix.creditPercent}
            disabled={isSubmitting}
            onChange={(value) =>
              handleChange({
                ...values,
                cardMix: { ...values.cardMix, creditPercent: value },
              })
            }
          />
          <PercentageInput
            id="otherPercent"
            label="Sonstige in Prozent"
            value={values.cardMix.otherPercent}
            disabled={isSubmitting}
            onChange={(value) =>
              handleChange({
                ...values,
                cardMix: { ...values.cardMix, otherPercent: value },
              })
            }
          />
        </div>
        <p
          className={`${styles.cardMixSummary} ${isCardMixValid ? styles.cardMixSummaryValid : styles.cardMixSummaryInvalid}`}
          role="status"
        >
          {cardMixSummary}
        </p>
        {errors.cardMix ? (
          <p className={styles.cardMixSummaryInvalid} role="alert">
            {errors.cardMix}
          </p>
        ) : null}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Bedarf und Vertrieb</h2>
        <div className={styles.grid}>
          <FormField id="requiredTerminalCount" label="Benötigte Anzahl Terminals" required error={errors.requiredTerminalCount}>
            <input
              id="requiredTerminalCount"
              className={`${styles.input} ${errors.requiredTerminalCount ? styles.inputError : ''}`}
              type="number"
              min={1}
              step={1}
              value={values.requiredTerminalCount}
              aria-invalid={Boolean(errors.requiredTerminalCount)}
              disabled={isSubmitting}
              onChange={(event) =>
                updateField('requiredTerminalCount', Number(event.target.value) || 1)
              }
            />
          </FormField>
          <FormField id="interest" label="Interesse" error={errors.interest}>
            <select
              id="interest"
              className={styles.select}
              value={values.interest}
              disabled={isSubmitting}
              onChange={(event) =>
                updateField('interest', event.target.value as CreateLeadInput['interest'])
              }
            >
              {LEAD_INTEREST_OPTIONS.map((interest) => (
                <option key={interest} value={interest}>
                  {LEAD_INTEREST_LABELS[interest]}
                </option>
              ))}
            </select>
          </FormField>
          {mode === 'edit' ? (
            <FormField id="status" label="Status">
              <select
                id="status"
                className={styles.select}
                value={values.status}
                disabled={isSubmitting}
                onChange={(event) =>
                  handleChange({
                    ...values,
                    status: event.target.value as EditLeadInput['status'],
                  })
                }
              >
                {LEAD_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {LEAD_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
          <FormField id="nextFollowUpAt" label="Nächster Kontakt" error={errors.nextFollowUpAt}>
            <input
              id="nextFollowUpAt"
              className={styles.input}
              type="datetime-local"
              value={values.nextFollowUpAt ? values.nextFollowUpAt.slice(0, 16) : ''}
              disabled={isSubmitting}
              onChange={(event) =>
                updateField(
                  'nextFollowUpAt',
                  event.target.value ? new Date(event.target.value).toISOString() : null,
                )
              }
            />
          </FormField>
          <div className={styles.fullWidth}>
            <FormField id="notes" label="Notizen" error={errors.notes}>
              <textarea
                id="notes"
                className={`${styles.textarea} ${errors.notes ? styles.textareaError : ''}`}
                value={values.notes}
                disabled={isSubmitting}
                onChange={(event) => updateField('notes', event.target.value)}
              />
            </FormField>
          </div>
        </div>
      </section>

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
        <button type="button" className={styles.secondary} onClick={onCancel} disabled={isSubmitting}>
          Abbrechen
        </button>
        {mode === 'create' ? (
          <button
            type="button"
            className={styles.discard}
            onClick={props.onDiscard}
            disabled={isSubmitting || !props.showDiscard}
          >
            Eingaben verwerfen
          </button>
        ) : null}
      </div>
    </form>
  );
}
