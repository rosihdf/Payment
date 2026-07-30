import { useMemo, useState } from 'react';
import { CurrencyInput } from '../../components/common/CurrencyInput';
import { FormField } from '../../components/common/FormField';
import { SearchField } from '../../components/common/SearchField';
import type {
  CreateOfferItemInput,
  OfferItemPriceType,
} from '../../domain/offer/offer';
import { OFFER_ITEM_PRICE_TYPE_LABELS } from '../../domain/offer/offer';
import type { Product, ProductPriceType } from '../../domain/product/product';
import type { CreateOfferErrors } from '../../services/offerValidation';
import { formatProductPrice } from '../../utils/formatProduct';
import formStyles from './OfferForm.module.css';

interface OfferItemsSectionProps {
  items: CreateOfferItemInput[];
  products: Product[];
  errors?: CreateOfferErrors;
  disabled?: boolean;
  onChange: (items: CreateOfferItemInput[]) => void;
}

function resolveUnitPriceCents(
  priceType: ProductPriceType,
  priceCents: number | null,
): number | null {
  if (priceType === 'included') {
    return 0;
  }

  if (priceType === 'on_request') {
    return null;
  }

  return priceCents;
}

function createProductItemInput(product: Product): CreateOfferItemInput {
  return {
    type: 'product',
    productId: product.id,
    name: product.name,
    description: product.description,
    quantity: 1,
    priceType: product.priceType,
    unitPriceCents: resolveUnitPriceCents(product.priceType, product.priceCents),
    unitLabel: product.unitLabel,
    priceOverrideReason: '',
  };
}

function createSecondaryManualItemInput(product: Product): CreateOfferItemInput | null {
  if (!product.secondaryPriceType) {
    return null;
  }

  return {
    type: 'manual',
    productId: null,
    name: product.secondaryPriceLabel?.trim() || `${product.name} (Zusatzpreis)`,
    description: '',
    quantity: 1,
    priceType: product.secondaryPriceType,
    unitPriceCents: resolveUnitPriceCents(
      product.secondaryPriceType,
      product.secondaryPriceCents,
    ),
    unitLabel: null,
    priceOverrideReason: '',
  };
}

function createEmptyManualItemInput(): CreateOfferItemInput {
  return {
    type: 'manual',
    productId: null,
    name: '',
    description: '',
    quantity: 1,
    priceType: 'one_time',
    unitPriceCents: 0,
    unitLabel: null,
    priceOverrideReason: '',
  };
}

function isPriceInputDisabled(priceType: OfferItemPriceType): boolean {
  return priceType === 'on_request' || priceType === 'included';
}

export function OfferItemsSection({
  items,
  products,
  errors,
  disabled = false,
  onChange,
}: OfferItemsSectionProps) {
  const [productSearch, setProductSearch] = useState('');

  const usedProductIds = useMemo(
    () =>
      new Set(
        items
          .filter((item) => item.type === 'product' && item.productId)
          .map((item) => item.productId as string),
      ),
    [items],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      if (usedProductIds.has(product.id)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [product.name, product.internalProductCode, product.manufacturer ?? '']
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [productSearch, products, usedProductIds]);

  const updateItem = (index: number, patch: Partial<CreateOfferItemInput>) => {
    const nextItems = items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    );
    onChange(nextItems);
  };

  const updatePriceType = (index: number, priceType: OfferItemPriceType) => {
    const item = items[index];
    if (!item) {
      return;
    }

    updateItem(index, {
      priceType,
      unitPriceCents:
        priceType === 'on_request'
          ? null
          : priceType === 'included'
            ? 0
            : item.unitPriceCents ?? 0,
    });
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  const addProduct = (product: Product) => {
    const nextItems = [...items, createProductItemInput(product)];
    const secondaryItem = createSecondaryManualItemInput(product);
    if (secondaryItem) {
      nextItems.push(secondaryItem);
    }
    onChange(nextItems);
    setProductSearch('');
  };

  const addManualItem = () => {
    onChange([...items, createEmptyManualItemInput()]);
  };

  return (
    <section className={formStyles.section}>
      <h2 className={formStyles.sectionTitle}>Positionen</h2>

      {errors?.items ? <p className={formStyles.errorBanner}>{errors.items}</p> : null}

      {!disabled ? (
        <>
          <div className={formStyles.catalog}>
            <SearchField
              value={productSearch}
              onChange={setProductSearch}
              label="Produktkatalog"
              placeholder="Produktname oder Code…"
            />

            {filteredProducts.length > 0 ? (
              <ul className={formStyles.catalogList}>
                {filteredProducts.slice(0, 8).map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      className={formStyles.catalogButton}
                      onClick={() => addProduct(product)}
                    >
                      <span className={formStyles.catalogName}>{product.name}</span>
                      <span className={formStyles.catalogMeta}>
                        {formatProductPrice(product.priceType, product.priceCents)}
                        {product.secondaryPriceType
                          ? ` · + ${product.secondaryPriceLabel ?? 'Zusatzpreis'}`
                          : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={formStyles.sectionHint}>
                {productSearch.trim()
                  ? 'Keine passenden Produkte gefunden.'
                  : 'Alle verfügbaren Produkte sind bereits im Angebot enthalten.'}
              </p>
            )}

            <button type="button" className={formStyles.listAddButton} onClick={addManualItem}>
              Manuelle Position hinzufügen
            </button>
          </div>
        </>
      ) : null}

      {items.length === 0 ? (
        <p className={formStyles.sectionHint}>
          Noch keine Positionen. Fügen Sie Produkte aus dem Katalog oder manuelle Positionen hinzu.
        </p>
      ) : (
        <ul className={formStyles.itemList}>
          {items.map((item, index) => {
            const itemErrors = errors?.itemErrors?.[index];
            const product = item.productId
              ? products.find((entry) => entry.id === item.productId)
              : null;
            const originalPrice =
              item.type === 'product' && product
                ? resolveUnitPriceCents(product.priceType, product.priceCents)
                : null;
            const isOverridden =
              item.type === 'product' &&
              originalPrice !== null &&
              item.unitPriceCents !== null &&
              item.priceType !== 'on_request' &&
              item.priceType !== 'included' &&
              item.unitPriceCents !== originalPrice;

            return (
              <li key={`${item.type}-${item.productId ?? 'manual'}-${index}`} className={formStyles.itemCard}>
                <div className={formStyles.itemHeader}>
                  <span className={formStyles.itemType}>
                    {item.type === 'product' ? 'Produkt' : 'Manuell'}
                  </span>
                  {!disabled ? (
                    <button
                      type="button"
                      className={formStyles.listRemoveButton}
                      onClick={() => removeItem(index)}
                    >
                      Entfernen
                    </button>
                  ) : null}
                </div>

                <div className={formStyles.grid}>
                  <FormField
                    id={`item-name-${index}`}
                    label="Bezeichnung"
                    required
                    error={itemErrors?.name}
                  >
                    <input
                      id={`item-name-${index}`}
                      className={`${formStyles.input} ${itemErrors?.name ? formStyles.inputError : ''}`}
                      value={item.name}
                      disabled={disabled || item.type === 'product'}
                      aria-invalid={Boolean(itemErrors?.name)}
                      onChange={(event) => updateItem(index, { name: event.target.value })}
                    />
                  </FormField>

                  <FormField id={`item-quantity-${index}`} label="Menge" error={itemErrors?.quantity}>
                    <input
                      id={`item-quantity-${index}`}
                      className={formStyles.input}
                      type="number"
                      min={1}
                      max={999}
                      value={item.quantity}
                      disabled={disabled}
                      aria-invalid={Boolean(itemErrors?.quantity)}
                      onChange={(event) =>
                        updateItem(index, { quantity: Number.parseInt(event.target.value, 10) || 1 })
                      }
                    />
                  </FormField>

                  <FormField id={`item-priceType-${index}`} label="Preisart">
                    <select
                      id={`item-priceType-${index}`}
                      className={formStyles.select}
                      value={item.priceType}
                      disabled={disabled || item.type === 'product'}
                      onChange={(event) =>
                        updatePriceType(index, event.target.value as OfferItemPriceType)
                      }
                    >
                      {(Object.keys(OFFER_ITEM_PRICE_TYPE_LABELS) as OfferItemPriceType[]).map(
                        (priceType) => (
                          <option key={priceType} value={priceType}>
                            {OFFER_ITEM_PRICE_TYPE_LABELS[priceType]}
                          </option>
                        ),
                      )}
                    </select>
                  </FormField>

                  <CurrencyInput
                    id={`item-price-${index}`}
                    label="Einzelpreis"
                    value={item.unitPriceCents}
                    error={itemErrors?.unitPriceCents}
                    disabled={disabled || isPriceInputDisabled(item.priceType)}
                    onChange={(value) => updateItem(index, { unitPriceCents: value })}
                  />

                  <FormField id={`item-unitLabel-${index}`} label="Einheit">
                    <input
                      id={`item-unitLabel-${index}`}
                      className={formStyles.input}
                      value={item.unitLabel ?? ''}
                      disabled={disabled}
                      onChange={(event) =>
                        updateItem(index, { unitLabel: event.target.value || null })
                      }
                    />
                  </FormField>

                  <div className={formStyles.fullWidth}>
                    <FormField id={`item-description-${index}`} label="Beschreibung">
                      <textarea
                        id={`item-description-${index}`}
                        className={formStyles.textarea}
                        value={item.description}
                        disabled={disabled}
                        onChange={(event) => updateItem(index, { description: event.target.value })}
                      />
                    </FormField>
                  </div>

                  {isOverridden ? (
                    <div className={formStyles.fullWidth}>
                      <FormField
                        id={`item-overrideReason-${index}`}
                        label="Begründung Preisüberschreibung"
                        required
                        error={itemErrors?.priceOverrideReason}
                      >
                        <textarea
                          id={`item-overrideReason-${index}`}
                          className={`${formStyles.textarea} ${
                            itemErrors?.priceOverrideReason ? formStyles.inputError : ''
                          }`}
                          value={item.priceOverrideReason}
                          disabled={disabled}
                          aria-invalid={Boolean(itemErrors?.priceOverrideReason)}
                          onChange={(event) =>
                            updateItem(index, { priceOverrideReason: event.target.value })
                          }
                        />
                      </FormField>
                    </div>
                  ) : null}

                  {itemErrors?.productId ? (
                    <p className={formStyles.fieldError}>{itemErrors.productId}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
