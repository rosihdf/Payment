import type { Tariff } from '../tariff/tariff';
import type { Product } from '../product/product';
import type { CustomerNeed } from '../recommendation/customerNeed';
import type { BestPaySolutionCandidate } from '../recommendation/bestPaySolutionCandidate';
import {
  createEmptyCostProjection,
  type CustomerCostProjection,
} from '../recommendation/customerCostProjection';
import {
  calculateCommercialProjection,
  mapCommercialProjectionToCustomerCostProjection,
} from '../commercial/calculateCommercialProjection';
import { buildCommercialConfig } from '../commercial/commercialConfig';

function resolveProjectionMonths(
  candidate: BestPaySolutionCandidate,
  configuredMonths: number | null,
): number {
  if (candidate.contractTermMonths !== null && candidate.contractTermMonths > 0) {
    return candidate.contractTermMonths;
  }

  if (configuredMonths !== null && configuredMonths > 0) {
    return configuredMonths;
  }

  return 24;
}

export function projectCustomerCosts(
  need: CustomerNeed,
  candidate: BestPaySolutionCandidate,
  tariff: Tariff | null,
  products: Map<string, Product>,
  configuredProjectionMonths: number | null,
): CustomerCostProjection {
  const projectionMonths = resolveProjectionMonths(candidate, configuredProjectionMonths);

  if (!tariff) {
    const empty = createEmptyCostProjection('EUR', projectionMonths, 'contract_term');
    empty.missingBasis = ['commercial.tariff'];
    return empty;
  }

  const terminalCount = candidate.quantity;
  let hardwareOneTimeCents = 0;
  let hardwareMonthlyCents = 0;

  for (const productId of candidate.hardwareProductIds) {
    const product = products.get(productId);
    if (!product) {
      const empty = createEmptyCostProjection('EUR', projectionMonths, 'contract_term');
      empty.missingBasis = [`hardware:${productId}`];
      return empty;
    }

    if (product.priceType === 'one_time' && product.priceCents !== null) {
      hardwareOneTimeCents += product.priceCents * terminalCount;
    } else if (product.priceType === 'monthly' && product.priceCents !== null) {
      hardwareMonthlyCents += product.priceCents * terminalCount;
    } else if (product.priceType === 'on_request') {
      const empty = createEmptyCostProjection('EUR', projectionMonths, 'contract_term');
      empty.missingBasis = [`hardware_price:${productId}`];
      return empty;
    }
  }

  const config = buildCommercialConfig({ need, candidate, tariff, products });
  const result = calculateCommercialProjection(need, config, {
    hardwareOneTimeCents,
    hardwareMonthlyCents,
  });

  return mapCommercialProjectionToCustomerCostProjection(result);
}

export { calculateCommercialProjection } from '../commercial/calculateCommercialProjection';
export { buildCommercialConfig } from '../commercial/commercialConfig';
