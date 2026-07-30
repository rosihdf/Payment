import type { FormEvent } from 'react';
import { CurrencyInput } from '../../components/common/CurrencyInput';
import { FormField } from '../../components/common/FormField';
import type {
  CreateProductInput,
  ProductFormMode,
  ProductPriceType,
} from '../../domain/product/product';
import {
  PRODUCT_CATEGORY_LABELS,
  PRODUCT_CATEGORY_OPTIONS,
  PRODUCT_PRICE_TYPE_LABELS,
  PRODUCT_PRICE_TYPE_OPTIONS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_OPTIONS,
} from '../../domain/product/product';
import type { CreateProductErrors } from '../../services/productValidation';
import { TerminalTypeSelector } from '../tariff/TerminalTypeSelector';
import styles from './ProductForm.module.css';

interface ProductFormProps {
  mode: ProductFormMode;
  values: CreateProductInput;
  errors: CreateProductErrors;
  isSubmitting: boolean;
  onChange: (values: CreateProductInput) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function StringListEditor({
  id,
  label,
  values,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <FormField id={id} label={label}>
      <div className={styles.stringList}>
        {values.map((value, index) => (
          <div key={`${id}-${index}`} className={styles.stringListRow}>
            <input
              id={`${id}-${index}`}
              className={styles.input}
              value={value}
              disabled={disabled}
              onChange={(event) => {
                const next = [...values];
                next[index] = event.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              className={styles.listRemoveButton}
              disabled={disabled}
              onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
            >
              Entfernen
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.listAddButton}
          disabled={disabled}
          onClick={() => onChange([...values, ''])}
        >
          Eintrag hinzufügen
        </button>
      </div>
    </FormField>
  );
}

function isPriceInputDisabled(priceType: ProductPriceType): boolean {
  return priceType === 'on_request' || priceType === 'included';
}

export function ProductForm({
  mode,
  values,
  errors,
  isSubmitting,
  onChange,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const updateField = <K extends keyof CreateProductInput>(
    field: K,
    value: CreateProductInput[K],
  ) => {
    onChange({ ...values, [field]: value });
  };

  const updatePriceType = (priceType: ProductPriceType) => {
    onChange({
      ...values,
      priceType,
      priceCents:
        priceType === 'on_request' ? null : priceType === 'included' ? 0 : values.priceCents ?? 0,
    });
  };

  const updateSecondaryPriceType = (secondaryPriceType: ProductPriceType | null) => {
    if (!secondaryPriceType) {
      onChange({
        ...values,
        secondaryPriceType: null,
        secondaryPriceCents: null,
        secondaryPriceLabel: null,
      });
      return;
    }

    onChange({
      ...values,
      secondaryPriceType,
      secondaryPriceCents:
        secondaryPriceType === 'on_request'
          ? null
          : secondaryPriceType === 'included'
            ? 0
            : values.secondaryPriceCents ?? 0,
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const submitLabel = mode === 'create' ? 'Produkt speichern' : 'Änderungen speichern';
  const submittingLabel =
    mode === 'create' ? 'Produkt wird angelegt…' : 'Änderungen werden gespeichert…';

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Identität</h2>
        <div className={styles.grid}>
          <FormField id="name" label="Produktname" required error={errors.name}>
            <input
              id="name"
              className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
              value={values.name}
              disabled={isSubmitting}
              onChange={(event) => updateField('name', event.target.value)}
            />
          </FormField>
          <FormField id="providerName" label="Anbieter" required error={errors.providerName}>
            <input
              id="providerName"
              className={styles.input}
              value={values.providerName}
              disabled={isSubmitting}
              onChange={(event) => updateField('providerName', event.target.value)}
            />
          </FormField>
          <FormField
            id="internalProductCode"
            label="Interner Produktcode"
            required
            error={errors.internalProductCode}
          >
            <input
              id="internalProductCode"
              className={styles.input}
              value={values.internalProductCode}
              disabled={isSubmitting}
              onChange={(event) => updateField('internalProductCode', event.target.value)}
            />
          </FormField>
          <FormField id="status" label="Status" required>
            <select
              id="status"
              className={styles.select}
              value={values.status}
              disabled={isSubmitting}
              onChange={(event) =>
                updateField('status', event.target.value as CreateProductInput['status'])
              }
            >
              {PRODUCT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {PRODUCT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="category" label="Kategorie" required>
            <select
              id="category"
              className={styles.select}
              value={values.category}
              disabled={isSubmitting}
              onChange={(event) =>
                updateField('category', event.target.value as CreateProductInput['category'])
              }
            >
              {PRODUCT_CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {PRODUCT_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </FormField>
          <div className={styles.fullWidth}>
            <FormField id="description" label="Beschreibung" error={errors.description}>
              <textarea
                id="description"
                className={styles.textarea}
                value={values.description}
                disabled={isSubmitting}
                onChange={(event) => updateField('description', event.target.value)}
              />
            </FormField>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Gerät</h2>
        <div className={styles.grid}>
          <FormField id="manufacturer" label="Hersteller">
            <input
              id="manufacturer"
              className={styles.input}
              value={values.manufacturer ?? ''}
              disabled={isSubmitting}
              onChange={(event) => updateField('manufacturer', event.target.value || null)}
            />
          </FormField>
          <FormField id="modelName" label="Modell">
            <input
              id="modelName"
              className={styles.input}
              value={values.modelName ?? ''}
              disabled={isSubmitting}
              onChange={(event) => updateField('modelName', event.target.value || null)}
            />
          </FormField>
        </div>
        <TerminalTypeSelector
          value={values.supportedTerminalTypes}
          onChange={(supportedTerminalTypes) =>
            updateField('supportedTerminalTypes', supportedTerminalTypes)
          }
          disabled={isSubmitting}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Hauptpreis</h2>
        <div className={styles.grid}>
          <FormField id="priceType" label="Preisart" required>
            <select
              id="priceType"
              className={styles.select}
              value={values.priceType}
              disabled={isSubmitting}
              onChange={(event) => updatePriceType(event.target.value as ProductPriceType)}
            >
              {PRODUCT_PRICE_TYPE_OPTIONS.map((priceType) => (
                <option key={priceType} value={priceType}>
                  {PRODUCT_PRICE_TYPE_LABELS[priceType]}
                </option>
              ))}
            </select>
          </FormField>
          <CurrencyInput
            id="priceCents"
            label="Preis"
            value={values.priceCents}
            error={errors.priceCents}
            disabled={isSubmitting || isPriceInputDisabled(values.priceType)}
            onChange={(value) => updateField('priceCents', value)}
          />
          <FormField id="unitLabel" label="Einheit">
            <input
              id="unitLabel"
              className={styles.input}
              value={values.unitLabel ?? ''}
              disabled={isSubmitting}
              onChange={(event) => updateField('unitLabel', event.target.value || null)}
            />
          </FormField>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Zweiter Preis</h2>
        <div className={styles.grid}>
          <FormField id="secondaryPriceType" label="Preisart">
            <select
              id="secondaryPriceType"
              className={styles.select}
              value={values.secondaryPriceType ?? ''}
              disabled={isSubmitting}
              onChange={(event) =>
                updateSecondaryPriceType(
                  event.target.value ? (event.target.value as ProductPriceType) : null,
                )
              }
            >
              <option value="">Kein zweiter Preis</option>
              {PRODUCT_PRICE_TYPE_OPTIONS.filter((type) => type !== 'on_request').map((priceType) => (
                <option key={priceType} value={priceType}>
                  {PRODUCT_PRICE_TYPE_LABELS[priceType]}
                </option>
              ))}
            </select>
          </FormField>
          <CurrencyInput
            id="secondaryPriceCents"
            label="Preis"
            value={values.secondaryPriceCents}
            error={errors.secondaryPriceCents}
            disabled={
              isSubmitting ||
              !values.secondaryPriceType ||
              isPriceInputDisabled(values.secondaryPriceType)
            }
            onChange={(value) => updateField('secondaryPriceCents', value)}
          />
          <FormField id="secondaryPriceLabel" label="Bezeichnung" error={errors.secondaryPriceLabel}>
            <input
              id="secondaryPriceLabel"
              className={styles.input}
              value={values.secondaryPriceLabel ?? ''}
              disabled={isSubmitting || !values.secondaryPriceType}
              onChange={(event) => updateField('secondaryPriceLabel', event.target.value || null)}
            />
          </FormField>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Leistungsumfang</h2>
        <StringListEditor
          id="includedFeatures"
          label="Enthaltene Leistungen"
          values={values.includedFeatures}
          disabled={isSubmitting}
          onChange={(includedFeatures) => updateField('includedFeatures', includedFeatures)}
        />
        <StringListEditor
          id="technicalFeatures"
          label="Technische Merkmale"
          values={values.technicalFeatures}
          disabled={isSubmitting}
          onChange={(technicalFeatures) => updateField('technicalFeatures', technicalFeatures)}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Quelle und Hinweise</h2>
        <div className={styles.grid}>
          <FormField id="sourceReference" label="Quellenreferenz">
            <input
              id="sourceReference"
              className={styles.input}
              value={values.sourceReference}
              disabled={isSubmitting}
              onChange={(event) => updateField('sourceReference', event.target.value)}
            />
          </FormField>
          <FormField id="validFrom" label="Gültig ab" error={errors.validFrom}>
            <input
              id="validFrom"
              className={styles.input}
              type="date"
              value={values.validFrom ?? ''}
              disabled={isSubmitting}
              onChange={(event) => updateField('validFrom', event.target.value || null)}
            />
          </FormField>
          <FormField id="validUntil" label="Gültig bis" error={errors.validUntil}>
            <input
              id="validUntil"
              className={styles.input}
              type="date"
              value={values.validUntil ?? ''}
              disabled={isSubmitting}
              onChange={(event) => updateField('validUntil', event.target.value || null)}
            />
          </FormField>
          <div className={styles.fullWidth}>
            <FormField id="notes" label="Interne Hinweise">
              <textarea
                id="notes"
                className={styles.textarea}
                value={values.notes}
                disabled={isSubmitting}
                onChange={(event) => updateField('notes', event.target.value)}
              />
            </FormField>
          </div>
        </div>
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
