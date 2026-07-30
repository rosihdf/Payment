import type { CreateOfferInput } from './offer';

function normalizeComparableInput(input: CreateOfferInput): CreateOfferInput {
  return {
    leadId: input.leadId.trim(),
    tariffId: input.tariffId?.trim() || null,
    title: input.title.trim(),
    introductionText: input.introductionText.trim(),
    internalNotes: input.internalNotes.trim(),
    customerNotes: input.customerNotes.trim(),
    validUntil: input.validUntil?.trim() || null,
    items: input.items.map((item) => ({
      type: item.type,
      productId: item.productId?.trim() || null,
      name: item.name.trim(),
      description: item.description.trim(),
      quantity: item.quantity,
      priceType: item.priceType,
      unitPriceCents: item.priceType === 'included' ? 0 : item.unitPriceCents,
      unitLabel: item.unitLabel?.trim() || null,
      priceOverrideReason: item.priceOverrideReason.trim(),
    })),
  };
}

export function isSameOfferInput(left: CreateOfferInput, right: CreateOfferInput): boolean {
  return JSON.stringify(normalizeComparableInput(left)) === JSON.stringify(normalizeComparableInput(right));
}

export function offerToFormInput(offer: {
  leadId: string;
  tariffSnapshot: { tariffId: string } | null;
  title: string;
  introductionText: string;
  internalNotes: string;
  customerNotes: string;
  validUntil: string | null;
  items: Array<{
    type: CreateOfferInput['items'][number]['type'];
    productSnapshot: { productId: string } | null;
    name: string;
    description: string;
    quantity: number;
    priceType: CreateOfferInput['items'][number]['priceType'];
    unitPriceCents: number | null;
    unitLabel: string | null;
    priceOverrideReason: string;
  }>;
}): CreateOfferInput {
  return {
    leadId: offer.leadId,
    tariffId: offer.tariffSnapshot?.tariffId ?? null,
    title: offer.title,
    introductionText: offer.introductionText,
    internalNotes: offer.internalNotes,
    customerNotes: offer.customerNotes,
    validUntil: offer.validUntil,
    items: offer.items.map((item) => ({
      type: item.type,
      productId: item.productSnapshot?.productId ?? null,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      priceType: item.priceType,
      unitPriceCents: item.unitPriceCents,
      unitLabel: item.unitLabel,
      priceOverrideReason: item.priceOverrideReason,
    })),
  };
}
