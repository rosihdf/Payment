import { FormField } from '../../components/common/FormField';
import type { CreateOfferInput } from '../../domain/offer/offer';
import type { OfferTotals } from '../../domain/offer/offer';
import type { CreateOfferErrors } from '../../services/offerValidation';
import { OfferTotalsDisplay } from './OfferTotalsDisplay';
import formStyles from './OfferForm.module.css';

interface OfferSummarySectionProps {
  values: Pick<
    CreateOfferInput,
    'title' | 'introductionText' | 'internalNotes' | 'customerNotes' | 'validUntil'
  >;
  totals: OfferTotals;
  errors?: CreateOfferErrors;
  disabled?: boolean;
  onChange: (
    patch: Partial<
      Pick<
        CreateOfferInput,
        'title' | 'introductionText' | 'internalNotes' | 'customerNotes' | 'validUntil'
      >
    >,
  ) => void;
}

export function OfferSummarySection({
  values,
  totals,
  errors,
  disabled = false,
  onChange,
}: OfferSummarySectionProps) {
  return (
    <section className={formStyles.section}>
      <h2 className={formStyles.sectionTitle}>Angebotsdetails</h2>

      <div className={formStyles.grid}>
        <FormField id="title" label="Angebotstitel" required error={errors?.title}>
          <input
            id="title"
            className={`${formStyles.input} ${errors?.title ? formStyles.inputError : ''}`}
            value={values.title}
            disabled={disabled}
            aria-invalid={Boolean(errors?.title)}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </FormField>

        <FormField id="validUntil" label="Gültig bis" error={errors?.validUntil}>
          <input
            id="validUntil"
            className={`${formStyles.input} ${errors?.validUntil ? formStyles.inputError : ''}`}
            type="date"
            value={values.validUntil ?? ''}
            disabled={disabled}
            aria-invalid={Boolean(errors?.validUntil)}
            onChange={(event) => onChange({ validUntil: event.target.value || null })}
          />
        </FormField>

        <div className={formStyles.fullWidth}>
          <FormField id="introductionText" label="Einleitungstext">
            <textarea
              id="introductionText"
              className={formStyles.textarea}
              value={values.introductionText}
              disabled={disabled}
              onChange={(event) => onChange({ introductionText: event.target.value })}
            />
          </FormField>
        </div>

        <div className={formStyles.fullWidth}>
          <FormField id="customerNotes" label="Hinweise für den Kunden">
            <textarea
              id="customerNotes"
              className={formStyles.textarea}
              value={values.customerNotes}
              disabled={disabled}
              onChange={(event) => onChange({ customerNotes: event.target.value })}
            />
          </FormField>
        </div>

        <div className={formStyles.fullWidth}>
          <FormField id="internalNotes" label="Interne Hinweise">
            <textarea
              id="internalNotes"
              className={formStyles.textarea}
              value={values.internalNotes}
              disabled={disabled}
              onChange={(event) => onChange({ internalNotes: event.target.value })}
            />
          </FormField>
        </div>
      </div>

      <div className={formStyles.totalsPanel}>
        <h3 className={formStyles.totalsTitle}>Live-Summen</h3>
        <OfferTotalsDisplay totals={totals} />
      </div>
    </section>
  );
}
