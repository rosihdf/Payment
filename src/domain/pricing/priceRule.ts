export type PriceRuleStatus = 'active' | 'inactive';

export type PriceRuleUnit = 'one_time' | 'monthly' | 'per_transaction' | 'per_unit' | 'percent_volume';

export interface PriceRule {
  id: string;
  priceBookVersionId: string;

  name: string;
  status: PriceRuleStatus;

  contractTypeId: string | null;
  productId: string | null;
  tariffId: string | null;
  contractTermId: string | null;
  industryId: string | null;

  priority: number;
  combinable: boolean;

  listPriceCents: number | null;
  targetPriceCents: number | null;
  minimumPriceCents: number | null;
  maxDiscountPercentTenths: number | null;

  unit: PriceRuleUnit;
  currency: string;

  validFrom: string | null;
  validUntil: string | null;

  createdAt: string;
  updatedAt: string;
}
