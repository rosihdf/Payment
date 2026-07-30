import { FormField } from '../../components/common/FormField';
import type { Tariff } from '../../domain/tariff/tariff';
import { TERMINAL_TYPE_LABELS } from '../../domain/tariff/tariff';
import { formatCentsToCurrency } from '../../utils/currency';
import { formatCardRate, formatGirocardClearing } from '../../utils/formatTariff';
import formStyles from './OfferForm.module.css';

interface OfferTariffSectionProps {
  tariffs: Tariff[];
  tariffId: string | null;
  error?: string;
  disabled?: boolean;
  onChange: (tariffId: string | null) => void;
}

export function OfferTariffSection({
  tariffs,
  tariffId,
  error,
  disabled = false,
  onChange,
}: OfferTariffSectionProps) {
  const selectedTariff = tariffs.find((tariff) => tariff.id === tariffId) ?? null;

  return (
    <section className={formStyles.section}>
      <h2 className={formStyles.sectionTitle}>Payment-Tarif</h2>
      <p className={formStyles.sectionHint}>
        Optional. Der Tarif wird als Snapshot im Angebot gespeichert.
      </p>

      <FormField id="tariffId" label="Tarif" error={error}>
        <select
          id="tariffId"
          className={`${formStyles.select} ${error ? formStyles.inputError : ''}`}
          value={tariffId ?? ''}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">Kein Tarif</option>
          {tariffs.map((tariff) => (
            <option key={tariff.id} value={tariff.id}>
              {tariff.name} ({tariff.productCode})
            </option>
          ))}
        </select>
      </FormField>

      {selectedTariff ? (
        <dl className={formStyles.preview}>
          <div className={formStyles.previewRow}>
            <dt>Anbieter</dt>
            <dd>{selectedTariff.providerName}</dd>
          </div>
          <div className={formStyles.previewRow}>
            <dt>Einsatzart</dt>
            <dd>
              {selectedTariff.supportedTerminalTypes
                .map((type) => TERMINAL_TYPE_LABELS[type])
                .join(', ') || '—'}
            </dd>
          </div>
          <div className={formStyles.previewRow}>
            <dt>Monatliche Fixkosten</dt>
            <dd>
              {formatCentsToCurrency(
                selectedTariff.monthlyAccountBaseFeeCents +
                  selectedTariff.monthlyTerminalRentalCents +
                  selectedTariff.monthlyServiceFeePerTerminalCents,
              )}{' '}
              / Monat
            </dd>
          </div>
          <div className={formStyles.previewRow}>
            <dt>Einrichtungsgebühr</dt>
            <dd>{formatCentsToCurrency(selectedTariff.setupFeeCents)} einmalig</dd>
          </div>
          <div className={formStyles.previewRow}>
            <dt>Girocard</dt>
            <dd>{formatCardRate(selectedTariff.cardRates.girocard)}</dd>
          </div>
          <div className={formStyles.previewRow}>
            <dt>Girocard-Clearing</dt>
            <dd>
              {formatGirocardClearing(
                selectedTariff.girocardClearingIncluded,
                selectedTariff.girocardClearingFeeTenthsOfCent,
              )}
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
