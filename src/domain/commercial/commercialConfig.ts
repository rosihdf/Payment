import type { ContractTerm } from '../pricing/contractTerm';
import type { Product } from '../product/product';
import type { Tariff } from '../tariff/tariff';
import type { CustomerNeed } from '../recommendation/customerNeed';
import type { BestPaySolutionCandidate } from '../recommendation/bestPaySolutionCandidate';
import { createProductionPricingCatalog } from '../catalog/pricingCatalogSeed';
import {
  getCommercialTermOptions,
  type CommercialTermOptions,
} from './commercialTermCapability';

/** Standard: fest beim Kunden über Kunden-WLAN. Optional: mobiler Betrieb mit SIM. */
export type CommercialDeploymentMode = 'stationary_wifi' | 'mobile_sim';

export const COMMERCIAL_SIM_PRODUCT_CODE = 'BP-A920-SIM';

/** Default-Tarifkontext für Beratungs-Wizard vor expliziter Produktwahl. */
export const DEFAULT_COMMERCIAL_TARIFF_ID = 'tariff_bestpay_a920_classic';

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

export function getCommercialTermOptionsForProduct(
  productId: string | null,
  options: { tariffId?: string | null } = {},
): CommercialTermOptions {
  return getCommercialTermOptions(productId, options);
}

/** @deprecated Nutze getCommercialTermOptionsForProduct. */
export function getStandardCommercialContractTerms(): ContractTerm[] {
  return createProductionPricingCatalog().contractTerms.filter((term) => term.status === 'active');
}

export function getAllowedContractTermMonthsForTariff(
  tariffId: string,
  productId: string | null = null,
): number[] {
  const options = getCommercialTermOptions(productId, { tariffId });
  return options.selectableDocumentedMonths;
}

export function resolveContractTermFromCatalog(
  termMonths: number | null,
  productId: string | null,
  tariffId: string | null,
): ContractTerm | null {
  if (termMonths === null) {
    return null;
  }
  const catalog = createProductionPricingCatalog().contractTerms;
  return catalog.find((term) => term.months === termMonths && term.status === 'active') ?? null;
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

function resolveProjectionMonths(input: {
  need: CustomerNeed;
  candidate: BestPaySolutionCandidate;
  productId: string | null;
  tariffId: string;
}): number {
  const explicit =
    input.candidate.contractTermMonths ?? input.need.contractPreferences.preferredTermMonths;

  if (explicit !== null && explicit > 0) {
    return explicit;
  }

  const options = getCommercialTermOptions(input.productId, { tariffId: input.tariffId });
  if (options.documentedTermsMonths.length > 0) {
    return options.documentedTermsMonths[0]!;
  }

  return 36;
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

  const productId = input.candidate.hardwareProductIds[0] ?? null;
  const projectionMonths = resolveProjectionMonths({
    need: input.need,
    candidate: input.candidate,
    productId,
    tariffId: input.tariff.id,
  });

  const contractTerm = resolveContractTermFromCatalog(
    projectionMonths,
    productId,
    input.tariff.id,
  );

  return {
    tariffId: input.tariff.id,
    tariffProductCode: input.tariff.productCode,
    productId,
    terminalModel: input.candidate.hardwareProductNames[0] ?? input.tariff.productCode,
    deploymentMode,
    contractTermMonths: projectionMonths,
    contractTermId: input.candidate.contractTermId ?? contractTerm?.id ?? null,
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
