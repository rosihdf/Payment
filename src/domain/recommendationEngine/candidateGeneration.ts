import type { ContractTerm } from '../pricing/contractTerm';
import type { Product } from '../product/product';
import type { Tariff, TerminalType } from '../tariff/tariff';
import type { CustomerNeed } from '../recommendation/customerNeed';
import type { BestPaySolutionCandidate } from '../recommendation/bestPaySolutionCandidate';
import { resolveDeploymentMode, resolveSimProduct } from '../commercial/commercialConfig';
import {
  getCommercialTermOptions,
  LEGACY_CONTRACT_TERM_MONTHS,
} from '../commercial/commercialTermCapability';
import { createEmptyCostProjection } from '../recommendation/customerCostProjection';
import { generateId } from '../../utils/id';

export interface RecommendationCatalogData {
  tariffs: Tariff[];
  products: Product[];
  contractTerms: ContractTerm[];
}

export interface CandidateBlueprint {
  tariff: Tariff;
  hardwareProduct: Product | null;
  contractTerm: ContractTerm | null;
  contractTermMonths: number | null;
  terminalType: TerminalType;
  quantity: number;
}

function isCatalogEntryValidOnDate(
  validFrom: string | null,
  validUntil: string | null,
  evaluationDate: string,
): boolean {
  const date = new Date(`${evaluationDate.slice(0, 10)}T00:00:00.000Z`);

  if (validFrom) {
    const from = new Date(`${validFrom.slice(0, 10)}T00:00:00.000Z`);
    if (date < from) {
      return false;
    }
  }

  if (validUntil) {
    const until = new Date(`${validUntil.slice(0, 10)}T00:00:00.000Z`);
    if (date > until) {
      return false;
    }
  }

  return true;
}

function resolveNeededTerminalTypes(need: CustomerNeed): TerminalType[] {
  const types: TerminalType[] = [];
  if (need.paymentUsage.stationary) {
    types.push('stationary');
  }
  if (need.paymentUsage.mobile) {
    types.push('mobile');
  }
  if (need.paymentUsage.softPos) {
    types.push('softpos');
  }
  if (need.paymentUsage.ecommerce) {
    types.push('ecommerce');
  }

  if (types.length === 0) {
    types.push('mobile');
  }

  return types;
}

function tariffSupportsTerminalType(tariff: Tariff, terminalType: TerminalType): boolean {
  return tariff.supportedTerminalTypes.includes(terminalType);
}

function productMatchesTerminalType(product: Product, terminalType: TerminalType): boolean {
  if (product.category !== 'payment_terminal') {
    return false;
  }

  return (
    product.supportedTerminalTypes.length === 0 ||
    product.supportedTerminalTypes.includes(terminalType)
  );
}

function selectContractTerms(
  need: CustomerNeed,
  terms: ContractTerm[],
  evaluationDate: string,
  context: { tariffId: string; productId: string | null },
): ContractTerm[] {
  const activeTerms = terms.filter(
    (term) =>
      term.status === 'active' &&
      isCatalogEntryValidOnDate(term.validFrom, term.validUntil, evaluationDate),
  );

  const termOptions = getCommercialTermOptions(context.productId, {
    tariffId: context.tariffId,
  });

  const documentedMonths = new Set(termOptions.documentedTermsMonths);
  const documentedTerms = activeTerms.filter((term) => documentedMonths.has(term.months));

  const maxMonths =
    need.contractPreferences.maxAcceptedTermMonths ??
    need.contractPreferences.preferredTermMonths ??
    null;

  const filtered = documentedTerms.filter(
    (term) => maxMonths === null || term.months <= maxMonths,
  );

  if (filtered.length > 0) {
    return filtered;
  }

  const preferred = need.contractPreferences.preferredTermMonths;
  if (preferred !== null && preferred > 0) {
    const preferredTerm = activeTerms.find((term) => term.months === preferred);
    if (preferredTerm) {
      return [preferredTerm];
    }
    if (
      termOptions.customTermAllowed ||
      LEGACY_CONTRACT_TERM_MONTHS.includes(
        preferred as (typeof LEGACY_CONTRACT_TERM_MONTHS)[number],
      )
    ) {
      return [
        {
          id: '',
          contractTypeId: null,
          name: `${preferred} Monate`,
          months: preferred,
          isStandard: false,
          status: 'active',
          validFrom: null,
          validUntil: null,
          createdAt: '',
          updatedAt: '',
        },
      ];
    }
  }

  return [];
}

export function buildCandidateBlueprints(
  need: CustomerNeed,
  catalog: RecommendationCatalogData,
): CandidateBlueprint[] {
  const evaluationDate = need.evaluationDate;
  const neededTerminalTypes = resolveNeededTerminalTypes(need);

  const activeTariffs = catalog.tariffs.filter(
    (tariff) =>
      tariff.status === 'active' &&
      isCatalogEntryValidOnDate(tariff.validFrom, tariff.validUntil, evaluationDate),
  );

  const activeProducts = catalog.products.filter(
    (product) =>
      product.status === 'active' &&
      isCatalogEntryValidOnDate(product.validFrom, product.validUntil, evaluationDate),
  );

  const blueprints: CandidateBlueprint[] = [];

  for (const tariff of activeTariffs) {
    for (const terminalType of neededTerminalTypes) {
      if (!tariffSupportsTerminalType(tariff, terminalType)) {
        continue;
      }

      const matchingHardware = activeProducts.filter((product) =>
        productMatchesTerminalType(product, terminalType),
      );

      const hardwareOptions = matchingHardware.length > 0 ? matchingHardware.slice(0, 1) : [null];

      for (const hardwareProduct of hardwareOptions) {
        const applicableTerms = selectContractTerms(
          need,
          catalog.contractTerms,
          evaluationDate,
          {
            tariffId: tariff.id,
            productId: hardwareProduct?.id ?? null,
          },
        );

        const termOptionsList =
          applicableTerms.length > 0
            ? applicableTerms
            : tariff.minimumContractMonths !== null
              ? [
                  {
                    id: '',
                    contractTypeId: null,
                    name: `${tariff.minimumContractMonths} Monate`,
                    months: tariff.minimumContractMonths,
                    isStandard: true,
                    status: 'active' as const,
                    validFrom: null,
                    validUntil: null,
                    createdAt: '',
                    updatedAt: '',
                  },
                ]
              : [null];

        for (const contractTerm of termOptionsList) {
          blueprints.push({
            tariff,
            hardwareProduct,
            contractTerm,
            contractTermMonths: contractTerm?.months ?? tariff.minimumContractMonths,
            terminalType,
            quantity: need.terminalCount,
          });
        }
      }
    }
  }

  return blueprints;
}

function createCandidateCode(blueprint: CandidateBlueprint, need: CustomerNeed): string {
  const hardwareCode = blueprint.hardwareProduct?.internalProductCode ?? 'no-hw';
  const termCode = blueprint.contractTerm?.months?.toString() ?? 'no-term';
  const deployment = resolveDeploymentMode(need);
  return `${blueprint.tariff.productCode}:${hardwareCode}:${termCode}:${blueprint.terminalType}:${deployment}`;
}

export function blueprintToCandidate(
  blueprint: CandidateBlueprint,
  need: CustomerNeed,
  allProducts: Product[] = [],
): BestPaySolutionCandidate {
  const projectionMonths =
    blueprint.contractTermMonths ??
    need.contractPreferences.preferredTermMonths ??
    36;
  const deploymentMode = resolveDeploymentMode(need);
  const accessoryItems: Array<{ productId: string; quantity: number }> = [];
  if (deploymentMode === 'mobile_sim') {
    const sim = resolveSimProduct(allProducts);
    if (sim) {
      accessoryItems.push({ productId: sim.id, quantity: blueprint.quantity });
    }
  }

  return {
    candidateId: generateId('rec_candidate'),
    candidateCode: createCandidateCode(blueprint, need),
    contractTypeId: blueprint.contractTerm?.contractTypeId ?? null,
    tariffId: blueprint.tariff.id,
    tariffName: blueprint.tariff.name,
    tariffProductCode: blueprint.tariff.productCode,
    terminalType: blueprint.terminalType,
    hardwareProductIds: blueprint.hardwareProduct ? [blueprint.hardwareProduct.id] : [],
    hardwareProductNames: blueprint.hardwareProduct ? [blueprint.hardwareProduct.name] : [],
    accessoryItems,
    contractTermId: blueprint.contractTerm?.id || null,
    contractTermMonths: blueprint.contractTermMonths,
    isStandardTerm: blueprint.contractTerm?.isStandard ?? false,
    quantity: blueprint.quantity,
    priceBookVersionId: null,
    pricingEvaluation: null,
    commissionPreview: null,
    costProjection: createEmptyCostProjection('EUR', projectionMonths, 'contract_term'),
    fulfilledRequirements: [],
    unfulfilledRequirements: [],
    hints: [],
    warnings: [],
    exclusionReasons: [],
    status: 'eligible',
    rank: null,
  };
}

export function generateCandidatesFromCatalog(
  need: CustomerNeed,
  catalog: RecommendationCatalogData,
): BestPaySolutionCandidate[] {
  const blueprints = buildCandidateBlueprints(need, catalog);
  const seenCodes = new Set<string>();
  const candidates: BestPaySolutionCandidate[] = [];

  for (const blueprint of blueprints) {
    const code = createCandidateCode(blueprint, need);
    if (seenCodes.has(code)) {
      continue;
    }
    seenCodes.add(code);
    candidates.push(blueprintToCandidate(blueprint, need, catalog.products));
  }

  return candidates;
}
