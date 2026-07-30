export type PriceBookVersionStatus = 'draft' | 'published' | 'archived';

export interface PriceBook {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PriceBookVersion {
  id: string;
  priceBookId: string;
  versionNumber: number;
  status: PriceBookVersionStatus;
  validFrom: string;
  validUntil: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
