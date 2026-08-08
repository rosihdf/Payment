import type { ContractTerm } from '../pricing/contractTerm';
import type { Product } from '../product/product';
import type { Tariff } from '../tariff/tariff';
import type { CustomerNeed } from '../recommendation/customerNeed';
import type { BestPaySolutionCandidate } from '../recommendation/bestPaySolutionCandidate';
import { createProductionPricingCatalog } from '../catalog/pricingCatalogSeed';

/** Standard: fest beim Kunden über Kunden-WLAN. Optional: mobiler Betrieb mit SIM. */
export type CommercialDeploymentMode = 'stationary_wifi' | 'mobile_sim';

export const COMMERCIAL_SIM_PRODUCT_CODE = 'BP-A920-SIM';

export interface CommercialConfig {
  tariffId: string;
  tariffProductCode: string;
  productId: string | null;
  terminalModel: string;
  deploymentMode: CommercialDeploymentMode;
  contractTermMonths: number;
  contractTermId: string | null;
  terminalCount: number;

  monthlyAccountBaseFeeCents: number;
  monthlyTerminalRentalCents: number;
  monthlyServiceFeePerTerminalCents: number;
  setupFeeCents: number;
  simMonthlyFeeCents: number;
  simProductId: string | null;

  additionalTransactionFeeTenthsOfCent: number;
  girocardClearingFeeTenthsOfCent: number;
  girocardClearingIncluded: boolean;
  cardRates: Tariff['cardRates'];
}

export function resolveDeploymentMode(need: CustomerNeed): CommercialDeploymentMode {
  if (need.paymentUsage.mobile && !need.paymentUsage.stationary) {
    return 'mobile_sim';
  }
  return 'stationary_wifi';
}

export function getStandardCommercialContractTerms(): ContractTerm[] {
  return createProductionPricingCatalog().contractTerms.filter((term) => term.isStandard);
}

export function getAllowedContractTermMonthsForTariff(_tariffId: string): number[] {
  return getStandardCommercialContractTerms()
    .map((term) => term.months)
    .sort((left, right) => left - right);
}

export function resolveSimProduct(products: Product[]): Product | null {
  return (
    products.find(
      (product) =>
        product.internalProductCode === COMMERCIAL_SIM_PRODUCT_CODE &&
        product.status === 'active' &&
        product.priceType === 'monthly',
    ) ?? null
  );
}

export function buildCommercialConfig(input: {
  need: CustomerNeed;
  candidate: BestPaySolutionCandidate;
  tariff: Tariff;
  products: Map<string, Product>;
}): CommercialConfig {
  const deploymentMode = resolveDeploymentMode(input.need);
  const simProduct =
    deploymentMode === 'mobile_sim' ? resolveSimProduct([...input.products.values()]) : null;

  const projectionMonths =
    input.candidate.contractTermMonths ??
    input.need.contractPreferences.preferredTermMonths ??
    24;

  return {
    tariffId: input.tariff.id,
    tariffProductCode: input.tariff.productCode,
    productId: input.candidate.hardwareProductIds[0] ?? null,
    terminalModel: input.candidate.hardwareProductNames[0] ?? input.tariff.productCode,
    deploymentMode,
    contractTermMonths: projectionMonths,
    contractTermId: input.candidate.contractTermId,
    terminalCount: input.candidate.quantity,

    monthlyAccountBaseFeeCents: input.tariff.monthlyAccountBaseFeeCents,
    monthlyTerminalRentalCents: input.tariff.monthlyTerminalRentalCents,
    monthlyServiceFeePerTerminalCents: input.tariff.monthlyServiceFeePerTerminalCents,
    setupFeeCents: input.tariff.setupFeeCents,
    simMonthlyFeeCents:
      deploymentMode === 'mobile_sim' && simProduct?.priceCents != null
        ? simProduct.priceCents
        : 0,
    simProductId: simProduct?.id ?? null,

    additionalTransactionFeeTenthsOfCent: input.tariff.additionalTransactionFeeTenthsOfCent,
    girocardClearingFeeTenthsOfCent: input.tariff.girocardClearingFeeTenthsOfCent,
    girocardClearingIncluded: input.tariff.girocardClearingIncluded,
    cardRates: input.tariff.cardRates,
  };
}

export function commercialConfigDedupKey(config: CommercialConfig): string {
  return [
    config.tariffProductCode,
    config.deploymentMode,
    config.contractTermMonths,
    config.terminalCount,
    config.simProductId ?? 'no-sim',
  ].join(':');
}
