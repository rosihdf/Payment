export interface Identifiable {
  id: string;
}

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

export type SortDirection = 'asc' | 'desc';
