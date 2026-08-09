import type { Product } from '../product/product';
import { formatTenthsOfBasisPointToPercent } from '../../utils/percentage';
import { formatTenthsOfCentToCurrency } from '../../utils/tenthsOfCent';
import type { CreateOfferItemInput } from './offer';
import type { OfferCommercialSnapshot } from './offerCommercialSnapshot';

function formatTransactionRate(tenthsOfCent: number): string {
  return `${formatTenthsOfCentToCurrency(tenthsOfCent)} je Transaktion`;
}

function formatPercentRate(tenthsOfBasisPoint: number): string {
  return `${formatTenthsOfBasisPointToPercent(tenthsOfBasisPoint)} vom Kartenumsatz`;
}

export function materializeCreateOfferItemsFromCommercialSnapshot(
  snapshot: OfferCommercialSnapshot,
  productsById: Map<string, Product>,
): CreateOfferItemInput[] {
  const items: CreateOfferItemInput[] = [];
  const config = snapshot.commercialConfig;
  const breakdown = snapshot.projection.breakdown;
  const terminalCount = Math.max(1, config.terminalCount);
  const need = snapshot.needSnapshot;

  if (config.monthlyTerminalRentalCents > 0) {
    items.push({
      type: 'manual',
      productId: null,
      name: 'Terminalmiete',
      description: `${terminalCount} Terminal(s), fix monatlich`,
      quantity: terminalCount,
      priceType: 'monthly',
      unitPriceCents: config.monthlyTerminalRentalCents,
      unitLabel: 'EUR / Monat',
      priceOverrideReason: '',
    });
  }

  if (config.monthlyServiceFeePerTerminalCents > 0) {
    items.push({
      type: 'manual',
      productId: null,
      name: 'Servicepauschale',
      description: 'Fix monatlich je Terminal',
      quantity: terminalCount,
      priceType: 'monthly',
      unitPriceCents: config.monthlyServiceFeePerTerminalCents,
      unitLabel: 'EUR / Monat',
      priceOverrideReason: '',
    });
  }

  if (config.monthlyAccountBaseFeeCents > 0) {
    items.push({
      type: 'manual',
      productId: null,
      name: 'Kontoführung',
      description: 'Fix monatliche Kontogebühr',
      quantity: 1,
      priceType: 'monthly',
      unitPriceCents: config.monthlyAccountBaseFeeCents,
      unitLabel: 'EUR / Monat',
      priceOverrideReason: '',
    });
  }

  if (config.deploymentMode === 'mobile_sim' && config.simMonthlyFeeCents > 0 && config.simProductId) {
    const sim = productsById.get(config.simProductId);
    items.push({
      type: 'product',
      productId: config.simProductId,
      name: sim?.name ?? 'SIM-Karte',
      description: 'Mobiler Betrieb – monatliche SIM-Gebühr',
      quantity: terminalCount,
      priceType: 'monthly',
      unitPriceCents: config.simMonthlyFeeCents,
      unitLabel: sim?.unitLabel ?? 'EUR / Monat',
      priceOverrideReason: '',
    });
  }

  if (config.productId) {
    const hardware = productsById.get(config.productId);
    if (hardware) {
      items.push({
        type: 'product',
        productId: hardware.id,
        name: hardware.name,
        description: snapshot.identity.terminalModel,
        quantity: terminalCount,
        priceType:
          hardware.priceType === 'monthly'
            ? 'monthly'
            : hardware.priceType === 'one_time'
              ? 'one_time'
              : hardware.priceType === 'on_request'
                ? 'on_request'
                : 'included',
        unitPriceCents: hardware.priceCents,
        unitLabel: hardware.unitLabel,
        priceOverrideReason: '',
      });
    }
  }

  if (config.setupFeeCents > 0) {
    items.push({
      type: 'manual',
      productId: null,
      name: 'Aufschaltung / Einrichtung',
      description: 'Einmalige Einrichtungsgebühr',
      quantity: 1,
      priceType: 'one_time',
      unitPriceCents: config.setupFeeCents,
      unitLabel: 'EUR',
      priceOverrideReason: '',
    });
  }

  if (config.additionalTransactionFeeTenthsOfCent > 0) {
    const txCount = need.monthlyTransactions;
    items.push({
      type: 'manual',
      productId: null,
      name: 'Transaktionsentgelt',
      description:
        txCount !== null
          ? `${formatTransactionRate(config.additionalTransactionFeeTenthsOfCent)}; bei ${txCount} Vorgängen/Monat ≈ ${(breakdown.monthlyTransactionFixedCents / 100).toFixed(2)} €/Monat`
          : formatTransactionRate(config.additionalTransactionFeeTenthsOfCent),
      quantity: 1,
      priceType: 'monthly',
      unitPriceCents: breakdown.monthlyTransactionFixedCents,
      unitLabel: 'EUR / Monat (Prognose)',
      priceOverrideReason: '',
    });
  }

  if (!config.girocardClearingIncluded && config.girocardClearingFeeTenthsOfCent > 0) {
    items.push({
      type: 'manual',
      productId: null,
      name: 'Girocard-Clearing',
      description: `${formatTransactionRate(config.girocardClearingFeeTenthsOfCent)} (Clearing); Prognose ${(breakdown.monthlyClearingCents / 100).toFixed(2)} €/Monat`,
      quantity: 1,
      priceType: 'monthly',
      unitPriceCents: breakdown.monthlyClearingCents,
      unitLabel: 'EUR / Monat (Prognose)',
      priceOverrideReason: '',
    });
  }

  const giroRate = config.cardRates.girocard.percentageTenthsOfBasisPoint;
  if (giroRate > 0) {
    items.push({
      type: 'manual',
      productId: null,
      name: 'Girocard-Entgelt',
      description: `${formatPercentRate(giroRate)}; Prognose ${(breakdown.monthlyCardFeesCents / 100).toFixed(2)} €/Monat gesamt Kartenmix`,
      quantity: 1,
      priceType: 'monthly',
      unitPriceCents: breakdown.monthlyCardFeesCents,
      unitLabel: 'EUR / Monat (Prognose)',
      priceOverrideReason: '',
    });
  }

  return items;
}
