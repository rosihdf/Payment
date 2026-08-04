export type CommissionRuleStatus = 'active' | 'inactive';

export type CommissionType =
  | 'base_once'
  | 'transaction_share'
  | 'clearing_share'
  | 'terminal_share'
  | 'girocard_share'
  | 'hardware'
  | 'accessory'
  | 'recurring'
  | 'bonus'
  | 'malus'
  | 'price_reduction'
  | 'correction'
  | 'clawback';

export type CommissionCalculationBasis =
  | 'fixed_amount'
  | 'percentage_of_sale_price'
  | 'percentage_of_margin'
  | 'amount_per_transaction'
  | 'percentage_of_full_fee'
  | 'percentage_above_threshold'
  | 'amount_per_unit'
  | 'fixed_monthly'
  | 'configured_external_basis';

export interface CommissionRule {
  id: string;
  commissionPlanVersionId: string;
  name: string;
  status: CommissionRuleStatus;
  commissionType: CommissionType;
  calculationBasis: CommissionCalculationBasis;
  contractTypeCode: string | null;
  productId: string | null;
  tariffId: string | null;
  contractTermId: string | null;
  accessoryOnly: boolean;
  minTermMonthsExclusive: number | null;
  maxTermMonthsExclusive: number | null;
  exactTermMonths: number | null;
  priority: number;
  combinable: boolean;
  fixedAmountCents: number | null;
  percentTenthsOfBasisPoint: number | null;
  thresholdTenthsOfCent: number | null;
  currency: string;
  validFrom: string | null;
  validUntil: string | null;
  internalDescription: string;
  /** Anzeige-Prozent für Admin-Oberfläche (z. B. bei transaction_share). */
  displaySharePercent: number | null;
  createdAt: string;
  updatedAt: string;
}
