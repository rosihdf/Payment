import type { ContractTerm } from '../pricing/contractTerm';
import type { Product } from '../product/product';
import type { Tariff, TerminalType } from '../tariff/tariff';
import type { CustomerNeed } from '../recommendation/customerNeed';
import type { BestPaySolutionCandidate } from '../recommendation/bestPaySolutionCandidate';
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
): ContractTerm[] {
  const activeTerms = terms.filter(
    (term) =>
      term.status === 'active' &&
      isCatalogEntryValidOnDate(term.validFrom, term.validUntil, evaluationDate),
  );

  const maxMonths =
    need.contractPreferences.maxAcceptedTermMonths ??
    need.contractPreferences.preferredTermMonths ??
    null;

  const filtered = activeTerms.filter((term) => maxMonths === null || term.months <= maxMonths);

  const standardTerms = filtered.filter((term) => term.isStandard);
  if (standardTerms.length > 0) {
    return standardTerms.slice(0, 3);
  }

  return filtered.slice(0, 2);
}

export function buildCandidateBlueprints(
  need: CustomerNeed,
  catalog: RecommendationCatalogData,
): CandidateBlueprint[] {
  const evaluationDate = need.evaluationDate;
  const neededTerminalTypes = resolveNeededTerminalTypes(need);
  const applicableTerms = selectContractTerms(need, catalog.contractTerms, evaluationDate);

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
        const termOptions =
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

        for (const contractTerm of termOptions) {
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

function createCandidateCode(blueprint: CandidateBlueprint): string {
  const hardwareCode = blueprint.hardwareProduct?.internalProductCode ?? 'no-hw';
  const termCode = blueprint.contractTerm?.months?.toString() ?? 'no-term';
  return `${blueprint.tariff.productCode}:${hardwareCode}:${termCode}:${blueprint.terminalType}`;
}

export function blueprintToCandidate(blueprint: CandidateBlueprint): BestPaySolutionCandidate {
  const projectionMonths = blueprint.contractTermMonths ?? 24;

  return {
    candidateId: generateId('rec_candidate'),
    candidateCode: createCandidateCode(blueprint),
    contractTypeId: blueprint.contractTerm?.contractTypeId ?? null,
    tariffId: blueprint.tariff.id,
    tariffName: blueprint.tariff.name,
    tariffProductCode: blueprint.tariff.productCode,
    terminalType: blueprint.terminalType,
    hardwareProductIds: blueprint.hardwareProduct ? [blueprint.hardwareProduct.id] : [],
    hardwareProductNames: blueprint.hardwareProduct ? [blueprint.hardwareProduct.name] : [],
    accessoryItems: [],
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
    const code = createCandidateCode(blueprint);
    if (seenCodes.has(code)) {
      continue;
    }
    seenCodes.add(code);
    candidates.push(blueprintToCandidate(blueprint));
  }

  return candidates;
}
