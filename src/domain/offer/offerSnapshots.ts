import type { Lead } from '../lead/lead';
import type { Product } from '../product/product';
import type { Tariff } from '../tariff/tariff';
import type {
  OfferCustomerSnapshot,
  OfferItemPriceType,
  OfferProductSnapshot,
  OfferTariffSnapshot,
} from './offer';

export function createCustomerSnapshotFromLead(lead: Lead): OfferCustomerSnapshot {
  return {
    leadId: lead.id,
    companyName: lead.companyName,
    contactFirstName: lead.contactFirstName,
    contactLastName: lead.contactLastName,
    street: lead.street,
    postalCode: lead.postalCode,
    city: lead.city,
    email: lead.email,
    phone: lead.phone,
    taxNumber: '',
    vatId: '',
  };
}

export function createEmptyCustomerSnapshot(): OfferCustomerSnapshot {
  return {
    leadId: '',
    companyName: '',
    contactFirstName: '',
    contactLastName: '',
    street: '',
    postalCode: '',
    city: '',
    email: '',
    phone: '',
    taxNumber: '',
    vatId: '',
  };
}

export function createTariffSnapshotFromTariff(tariff: Tariff): OfferTariffSnapshot {
  const terminalType = tariff.supportedTerminalTypes[0] ?? 'stationary';

  return {
    tariffId: tariff.id,
    internalTariffCode: tariff.productCode,
    name: tariff.name,
    providerName: tariff.providerName,
    description: tariff.description,
    terminalType,
    monthlyAccountBaseFeeCents: tariff.monthlyAccountBaseFeeCents,
    monthlyTerminalRentalCents: tariff.monthlyTerminalRentalCents,
    monthlyServiceFeePerTerminalCents: tariff.monthlyServiceFeePerTerminalCents,
    setupFeeCents: tariff.setupFeeCents,
    transactionFeeTenthsOfCent: tariff.additionalTransactionFeeTenthsOfCent,
    girocardClearingFeeTenthsOfCent: tariff.girocardClearingFeeTenthsOfCent,
    girocardClearingIncluded: tariff.girocardClearingIncluded,
    girocardRateTenthsOfBasisPoint: tariff.cardRates.girocard.percentageTenthsOfBasisPoint,
    debitCardRateTenthsOfBasisPoint: tariff.cardRates.debit.percentageTenthsOfBasisPoint,
    creditCardRateTenthsOfBasisPoint: tariff.cardRates.credit.percentageTenthsOfBasisPoint,
    contractDurationMonths: tariff.minimumContractMonths,
    noticePeriodMonths: tariff.noticePeriodMonths,
    minimumTurnoverCents: tariff.minimumMonthlyFeeCents,
    sourceReference: '',
    notes: tariff.notes,
  };
}

export function createProductSnapshotFromProduct(
  product: Product,
  priceType: OfferItemPriceType,
  unitPriceCents: number | null,
): OfferProductSnapshot {
  return {
    productId: product.id,
    internalProductCode: product.internalProductCode,
    name: product.name,
    providerName: product.providerName,
    category: product.category,
    description: product.description,
    manufacturer: product.manufacturer,
    modelName: product.modelName,
    priceType,
    unitPriceCents,
    unitLabel: product.unitLabel,
    sourceReference: product.sourceReference,
  };
}

export function copyTariffSnapshot(snapshot: OfferTariffSnapshot): OfferTariffSnapshot {
  return { ...snapshot };
}

export function copyProductSnapshot(snapshot: OfferProductSnapshot): OfferProductSnapshot {
  return { ...snapshot };
}

export function copyCustomerSnapshot(snapshot: OfferCustomerSnapshot): OfferCustomerSnapshot {
  return { ...snapshot };
}
