import type { TerminalType } from '../tariff/tariff';

export type ProductCategory =
  | 'payment_terminal'
  | 'cash_register'
  | 'cash_register_module'
  | 'accessory'
  | 'service';

export type ProductPriceType = 'monthly' | 'one_time' | 'included' | 'on_request';

export type ProductStatus = 'active' | 'inactive';

export type ProductFormMode = 'create' | 'edit';

export interface Product {
  id: string;
  name: string;
  providerName: string;
  internalProductCode: string;
  category: ProductCategory;
  status: ProductStatus;
  description: string;
  manufacturer: string | null;
  modelName: string | null;
  supportedTerminalTypes: TerminalType[];
  priceType: ProductPriceType;
  priceCents: number | null;
  secondaryPriceType: ProductPriceType | null;
  secondaryPriceCents: number | null;
  secondaryPriceLabel: string | null;
  unitLabel: string | null;
  includedFeatures: string[];
  technicalFeatures: string[];
  sourceReference: string;
  notes: string;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  name: string;
  providerName: string;
  internalProductCode: string;
  category: ProductCategory;
  status: ProductStatus;
  description: string;
  manufacturer: string | null;
  modelName: string | null;
  supportedTerminalTypes: TerminalType[];
  priceType: ProductPriceType;
  priceCents: number | null;
  secondaryPriceType: ProductPriceType | null;
  secondaryPriceCents: number | null;
  secondaryPriceLabel: string | null;
  unitLabel: string | null;
  includedFeatures: string[];
  technicalFeatures: string[];
  sourceReference: string;
  notes: string;
  validFrom: string | null;
  validUntil: string | null;
}

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  payment_terminal: 'Kartenterminal',
  cash_register: 'Kassensystem',
  cash_register_module: 'Kassenmodul',
  accessory: 'Zubehör',
  service: 'Dienstleistung',
};

export const PRODUCT_PRICE_TYPE_LABELS: Record<ProductPriceType, string> = {
  monthly: 'Monatlich',
  one_time: 'Einmalig',
  included: 'Inklusive',
  on_request: 'Auf Anfrage',
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
};

export const PRODUCT_CATEGORY_OPTIONS: ProductCategory[] = [
  'payment_terminal',
  'cash_register',
  'cash_register_module',
  'accessory',
  'service',
];

export const PRODUCT_PRICE_TYPE_OPTIONS: ProductPriceType[] = [
  'monthly',
  'one_time',
  'included',
  'on_request',
];

export const PRODUCT_STATUS_OPTIONS: ProductStatus[] = ['active', 'inactive'];

export type ProductStatusFilter = 'all' | ProductStatus;
export type ProductCategoryFilter = 'all' | ProductCategory;
export type ProductTerminalTypeFilter = 'all' | TerminalType;

export const PRODUCT_CATEGORY_ORDER: ProductCategory[] = [
  'payment_terminal',
  'cash_register',
  'cash_register_module',
  'accessory',
  'service',
];
