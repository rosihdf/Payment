import type {
  CreateOfferInput,
  CreateOfferItemInput,
  Offer,
  OfferItemPriceType,
  OfferStatus,
} from '../domain/offer/offer';
import { isValidOfferNumberFormat } from '../domain/offer/offerNumber';
import { normalizeCreateOfferInput } from '../domain/offer/normalizeOffer';
import { isPriceOverridden } from '../domain/offer/offerCalculations';

export type CreateOfferField = keyof CreateOfferInput | 'items';

export type CreateOfferItemField = keyof CreateOfferItemInput;

export type CreateOfferErrors = Partial<Record<CreateOfferField, string>> & {
  itemErrors?: Record<number, Partial<Record<CreateOfferItemField, string>>>;
};

function validatePriceForType(
  priceType: OfferItemPriceType,
  priceCents: number | null,
  label: string,
): string | undefined {
  if (priceType === 'on_request') {
    if (priceCents !== null) {
      return `${label}: Bei „Auf Anfrage“ darf kein Preis gespeichert werden.`;
    }

    return undefined;
  }

  if (priceType === 'included') {
    if (priceCents !== null && priceCents !== 0) {
      return `${label}: Bei „Inklusive“ muss der Preis 0 sein.`;
    }

    return undefined;
  }

  if (priceCents === null || !Number.isInteger(priceCents) || priceCents < 0) {
    return `${label}: Bitte geben Sie einen nicht negativen Preis an.`;
  }

  return undefined;
}

function validateItem(
  item: CreateOfferItemInput,
  index: number,
  originalUnitPriceCents: number | null,
): Partial<Record<CreateOfferItemField, string>> {
  const errors: Partial<Record<CreateOfferItemField, string>> = {};

  if (!item.name.trim()) {
    errors.name = 'Bitte geben Sie einen Positionsnamen ein.';
  }

  if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) {
    errors.quantity = 'Die Menge muss zwischen 1 und 999 liegen.';
  }

  const priceError = validatePriceForType(
    item.priceType,
    item.priceType === 'included' ? item.unitPriceCents ?? 0 : item.unitPriceCents,
    'Der Einzelpreis',
  );

  if (priceError) {
    errors.unitPriceCents = priceError;
  }

  if (item.type === 'product' && !item.productId?.trim()) {
    errors.productId = 'Produktpositionen benötigen eine Produkt-ID.';
  }

  if (item.type === 'manual' && item.productId?.trim()) {
    errors.productId = 'Manuelle Positionen dürfen keine Produkt-ID besitzen.';
  }

  const overridden = isPriceOverridden(item.priceType, item.unitPriceCents, originalUnitPriceCents);
  if (overridden && !item.priceOverrideReason.trim()) {
    errors.priceOverrideReason = 'Bitte geben Sie eine Begründung für die Preisüberschreibung an.';
  }

  if (Object.keys(errors).length > 0) {
    errors.name = errors.name ?? `Position ${index + 1} ist unvollständig.`;
  }

  return errors;
}

export function sanitizeOfferInput(input: CreateOfferInput): CreateOfferInput {
  const normalized = normalizeCreateOfferInput(input);

  return {
    ...normalized,
    items: normalized.items.map((item) => ({
      ...item,
      unitPriceCents:
        item.priceType === 'included' ? 0 : item.priceType === 'on_request' ? null : item.unitPriceCents,
    })),
  };
}

export function validateCreateOfferInput(
  input: CreateOfferInput,
  options?: {
    existingOffer?: Offer | null;
    createdAt?: string;
    originalPricesByProductId?: Map<string, number | null>;
  },
): CreateOfferErrors {
  const errors: CreateOfferErrors = {};
  const sanitized = sanitizeOfferInput(input);
  const itemErrors: Record<number, Partial<Record<CreateOfferItemField, string>>> = {};

  if (!sanitized.leadId.trim()) {
    errors.leadId = 'Bitte wählen Sie einen Lead aus.';
  }

  if (!sanitized.title.trim()) {
    errors.title = 'Bitte geben Sie einen Angebotstitel ein.';
  }

  if (sanitized.validUntil) {
    const validUntilDate = new Date(sanitized.validUntil);
    if (Number.isNaN(validUntilDate.getTime())) {
      errors.validUntil = 'Bitte geben Sie ein gültiges Datum ein.';
    } else if (options?.createdAt) {
      const createdAtDate = new Date(options.createdAt);
      if (!Number.isNaN(createdAtDate.getTime()) && validUntilDate < createdAtDate) {
        errors.validUntil = 'Das Gültigkeitsdatum darf nicht vor dem Erstellungsdatum liegen.';
      }
    }
  }

  const hasTariff = Boolean(sanitized.tariffId?.trim());
  const hasItems = sanitized.items.length > 0;

  if (!hasTariff && !hasItems) {
    errors.items = 'Bitte wählen Sie mindestens einen Payment-Tarif oder eine Position aus.';
  }

  const productIds = new Set<string>();

  sanitized.items.forEach((item, index) => {
    const originalPrice =
      item.type === 'product' && item.productId
        ? (options?.originalPricesByProductId?.get(item.productId) ?? null)
        : null;

    const fieldErrors = validateItem(item, index, originalPrice);
    if (Object.keys(fieldErrors).length > 0) {
      itemErrors[index] = fieldErrors;
    }

    if (item.type === 'product' && item.productId) {
      if (productIds.has(item.productId)) {
        itemErrors[index] = {
          ...itemErrors[index],
          productId: 'Dieses Produkt ist bereits im Angebot enthalten.',
        };
      }

      productIds.add(item.productId);
    }
  });

  if (Object.keys(itemErrors).length > 0) {
    errors.itemErrors = itemErrors;
  }

  const itemIds = sanitized.items.map((_, index) => index);
  if (new Set(itemIds).size !== itemIds.length) {
    errors.items = 'Positionen enthalten doppelte Einträge.';
  }

  if (options?.existingOffer) {
    if (options.existingOffer.status !== 'draft') {
      errors.title = 'Abgeschlossene oder stornierte Angebote können nicht bearbeitet werden.';
    }
  }

  return errors;
}

export function validateOfferNumber(offerNumber: string): string | undefined {
  if (!offerNumber.trim()) {
    return 'Angebotsnummer fehlt.';
  }

  if (!isValidOfferNumberFormat(offerNumber)) {
    return 'Angebotsnummer hat ein ungültiges Format.';
  }

  return undefined;
}

export function validateCancellationReason(reason: string): string | undefined {
  if (!reason.trim()) {
    return 'Bitte geben Sie einen Stornierungsgrund an.';
  }

  return undefined;
}

export function validateOfferStatus(status: OfferStatus): boolean {
  return status === 'draft' || status === 'completed' || status === 'cancelled';
}

export function hasOfferValidationErrors(errors: CreateOfferErrors): boolean {
  return Object.keys(errors).some((key) => key !== 'itemErrors') || Boolean(errors.itemErrors);
}
