import type { FormEvent } from 'react';
import { useMemo } from 'react';
import type {
  CreateOfferInput,
  OfferFormMode,
  OfferItem,
  OfferTariffSnapshot,
} from '../../domain/offer/offer';
import { calculateOfferTotals } from '../../domain/offer/offerCalculations';
import { createTariffSnapshotFromTariff } from '../../domain/offer/offerSnapshots';
import type { Lead } from '../../domain/lead/lead';
import type { Product } from '../../domain/product/product';
import type { Tariff } from '../../domain/tariff/tariff';
import type { CreateOfferErrors } from '../../services/offerValidation';
import { OfferCustomerSection } from './OfferCustomerSection';
import { OfferItemsSection } from './OfferItemsSection';
import { OfferSummarySection } from './OfferSummarySection';
import { OfferTariffSection } from './OfferTariffSection';
import styles from './OfferForm.module.css';

interface OfferFormProps {
  mode: OfferFormMode;
  values: CreateOfferInput;
  errors: CreateOfferErrors;
  leads: Lead[];
  tariffs: Tariff[];
  products: Product[];
  isSubmitting: boolean;
  readOnly?: boolean;
  onChange: (values: CreateOfferInput) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function buildCalculationItems(items: CreateOfferInput['items']): OfferItem[] {
  const timestamp = new Date().toISOString();

  return items.map((item, index) => ({
    id: `temp-${index}`,
    type: item.type,
    productSnapshot: null,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    priceType: item.priceType,
    unitPriceCents:
      item.priceType === 'included'
        ? 0
        : item.priceType === 'on_request'
          ? null
          : item.unitPriceCents,
    unitLabel: item.unitLabel,
    originalUnitPriceCents: null,
    priceOverridden: false,
    priceOverrideReason: item.priceOverrideReason,
    sortOrder: index,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

function resolveTariffSnapshot(
  tariffId: string | null,
  tariffs: Tariff[],
): OfferTariffSnapshot | null {
  if (!tariffId) {
    return null;
  }

  const tariff = tariffs.find((entry) => entry.id === tariffId);
  return tariff ? createTariffSnapshotFromTariff(tariff) : null;
}

export function OfferForm({
  mode,
  values,
  errors,
  leads,
  tariffs,
  products,
  isSubmitting,
  readOnly = false,
  onChange,
  onSubmit,
  onCancel,
}: OfferFormProps) {
  const disabled = isSubmitting || readOnly;

  const totals = useMemo(() => {
    const tariffSnapshot = resolveTariffSnapshot(values.tariffId, tariffs);
    return calculateOfferTotals({
      items: buildCalculationItems(values.items),
      tariffSnapshot,
    });
  }, [tariffs, values.items, values.tariffId]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!readOnly) {
      onSubmit();
    }
  };

  const submitLabel = mode === 'create' ? 'Angebot speichern' : 'Änderungen speichern';
  const submittingLabel =
    mode === 'create' ? 'Angebot wird angelegt…' : 'Änderungen werden gespeichert…';

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {readOnly ? (
        <p className={styles.readOnlyHint}>
          Dieses Angebot ist abgeschlossen oder storniert und kann nicht mehr bearbeitet werden.
        </p>
      ) : null}

      <OfferCustomerSection
        leads={leads}
        leadId={values.leadId}
        error={errors.leadId}
        disabled={disabled}
        onChange={(leadId) => onChange({ ...values, leadId })}
      />

      <OfferTariffSection
        tariffs={tariffs}
        tariffId={values.tariffId}
        error={errors.tariffId}
        disabled={disabled}
        onChange={(tariffId) => onChange({ ...values, tariffId })}
      />

      <OfferItemsSection
        items={values.items}
        products={products}
        errors={errors}
        disabled={disabled}
        onChange={(items) => onChange({ ...values, items })}
      />

      <OfferSummarySection
        values={values}
        totals={totals}
        errors={errors}
        disabled={disabled}
        onChange={(patch) => onChange({ ...values, ...patch })}
      />

      {!readOnly ? (
        <div className={styles.actions}>
          <button type="submit" className={styles.primary} disabled={isSubmitting}>
            {isSubmitting ? submittingLabel : submitLabel}
          </button>
          <button type="button" className={styles.secondary} disabled={isSubmitting} onClick={onCancel}>
            Abbrechen
          </button>
        </div>
      ) : null}
    </form>
  );
}
