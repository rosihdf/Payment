import type { FormEvent } from 'react';
import { CheckboxField } from '../../components/common/CheckboxField';
import { CurrencyInput } from '../../components/common/CurrencyInput';
import { FormField as LegacyFormField, textareaClassName } from '../../components/common/FormField';
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
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import styles from '../../features/lead/LeadForm.module.css';

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

  const submitLabel = mode === 'create' ? 'Kunde speichern' : 'Änderungen speichern';
  const submittingLabel = mode === 'create' ? 'Wird gespeichert…' : 'Wird gespeichert…';

  return (
    <form className={styles.form} aria-label="Lead-Erfassung" onSubmit={handleSubmit} noValidate>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Unternehmen und Ansprechpartner</h2>
        <div className={styles.grid}>
          <FormField type="text" id="companyName" label="Firmenname" required error={errors.companyName} value={values.companyName} disabled={isSubmitting} onChange={(event) => updateField('companyName', event.target.value)} />
          <FormField type="text" id="industry" label="Branche" error={errors.industry} value={values.industry} disabled={isSubmitting} onChange={(event) => updateField('industry', event.target.value)} />
          <FormField type="text" id="contactFirstName" label="Vorname" required error={errors.contactFirstName} value={values.contactFirstName} disabled={isSubmitting} onChange={(event) => updateField('contactFirstName', event.target.value)} />
          <FormField type="text" id="contactLastName" label="Nachname" required error={errors.contactLastName} value={values.contactLastName} disabled={isSubmitting} onChange={(event) => updateField('contactLastName', event.target.value)} />
          <FormField type="text" id="phone" label="Telefonnummer" required error={errors.phone} value={values.phone} disabled={isSubmitting} onChange={(event) => updateField('phone', event.target.value)} />
          <FormField type="email" id="email" label="E-Mail" error={errors.email} value={values.email} disabled={isSubmitting} onChange={(event) => updateField('email', event.target.value)} />
          <FormField type="text" id="street" label="Straße" error={errors.street} value={values.street} disabled={isSubmitting} onChange={(event) => updateField('street', event.target.value)} />
          <FormField type="text" id="postalCode" label="PLZ" error={errors.postalCode} inputMode="numeric" value={values.postalCode} disabled={isSubmitting} onChange={(event) => updateField('postalCode', event.target.value)} />
          <FormField type="text" id="city" label="Ort" error={errors.city} value={values.city} disabled={isSubmitting} onChange={(event) => updateField('city', event.target.value)} />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Aktuelle Payment-Situation</h2>
        <div className={styles.grid}>
          <FormField type="text" id="currentProvider" label="Aktueller Payment-Anbieter" error={errors.currentProvider} value={values.currentProvider} disabled={isSubmitting} onChange={(event) => updateField('currentProvider', event.target.value)} />
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
          <FormField type="text" id="currentTerminalModels" label="Vorhandene Terminalmodelle" error={errors.currentTerminalModels} value={values.currentTerminalModels} disabled={isSubmitting} onChange={(event) => updateField('currentTerminalModels', event.target.value)} />
          <FormField type="date" id="currentContractEndDate" label="Vertragsende" error={errors.currentContractEndDate} value={values.currentContractEndDate ?? ''} disabled={isSubmitting} onChange={(event) =>
                updateField('currentContractEndDate', event.target.value || null)
              } />
          <FormField type="text" id="currentNoticePeriod" label="Kündigungsfrist" error={errors.currentNoticePeriod} value={values.currentNoticePeriod} disabled={isSubmitting} onChange={(event) => updateField('currentNoticePeriod', event.target.value)} />
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
          <FormField type="number" id="requiredTerminalCount" label="Benötigte Anzahl Terminals" required error={errors.requiredTerminalCount} min={1} value={String(values.requiredTerminalCount)} disabled={isSubmitting} onChange={(event) =>
                updateField('requiredTerminalCount', Number(event.target.value) || 1)
              } />
          <FormField type="select" id="interest" label="Interesse" error={errors.interest}
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
            </FormField>
          {mode === 'edit' ? (
            <FormField type="select" id="status" label="Status"
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
              </FormField>
          ) : null}
          <FormField type="text" id="nextFollowUpAt" label="Nächster Kontakt" error={errors.nextFollowUpAt} value={values.nextFollowUpAt ? values.nextFollowUpAt.slice(0, 16) : ''} disabled={isSubmitting} onChange={(event) =>
                updateField(
                  'nextFollowUpAt',
                  event.target.value ? new Date(event.target.value).toISOString() : null,
                )
              } />
          <div className={styles.fullWidth}>
            <LegacyFormField id="notes" label="Notizen" error={errors.notes}>
              <textarea
                id="notes"
                className={textareaClassName(errors.notes)}
                value={values.notes}
                disabled={isSubmitting}
                onChange={(event) => updateField('notes', event.target.value)}
              />
            </LegacyFormField>
          </div>
        </div>
      </section>

      <div className={styles.actions}>
        <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Abbrechen
        </Button>
        {mode === 'create' ? (
          <Button
            type="button"
            variant="secondary"
            onClick={props.onDiscard}
            disabled={isSubmitting || !props.showDiscard}
          >
            Eingaben verwerfen
          </Button>
        ) : null}
      </div>
    </form>
  );
}
