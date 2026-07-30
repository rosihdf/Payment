export type BillingCostLineCategory =
  | 'monthly_base_fee'
  | 'terminal_rental'
  | 'terminal_purchase'
  | 'transaction_fee'
  | 'percentage_fee'
  | 'clearing_fee'
  | 'service_fee'
  | 'communication_fee'
  | 'setup_fee'
  | 'shipping_fee'
  | 'repair_fee'
  | 'credit'
  | 'tax'
  | 'other_recurring'
  | 'other_one_time';

export type BillingCostLineCostType = 'recurring' | 'one_time' | 'credit' | 'tax';

export type BillingCostLineSource = 'ocr' | 'manual' | 'corrected';

export interface BillingCostLineItem {
  id: string;
  sessionId: string;
  periodId: string | null;
  documentId: string | null;
  category: BillingCostLineCategory;
  label: string;
  amountCents: number;
  currency: string;
  costType: BillingCostLineCostType;
  quantity: number | null;
  unit: string | null;
  source: BillingCostLineSource;
  pageNumber: number | null;
  included: boolean;
  comment: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export const BILLING_COST_LINE_CATEGORY_LABELS: Record<BillingCostLineCategory, string> = {
  monthly_base_fee: 'Grundgebühr',
  terminal_rental: 'Terminalmiete',
  terminal_purchase: 'Terminalkauf',
  transaction_fee: 'Transaktionsgebühr',
  percentage_fee: 'Umsatzabhängige Gebühr',
  clearing_fee: 'Clearinggebühr',
  service_fee: 'Servicegebühr',
  communication_fee: 'Kommunikationspauschale',
  setup_fee: 'Einrichtung',
  shipping_fee: 'Versand',
  repair_fee: 'Reparatur',
  credit: 'Gutschrift',
  tax: 'Steuer',
  other_recurring: 'Sonstige laufende Gebühr',
  other_one_time: 'Sonstige einmalige Gebühr',
};
