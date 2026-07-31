export const CURRENT_ACTIVATION_BLOCKER_SCHEMA_VERSION = 1;

export type ActivationBlockerCategory =
  | 'documents'
  | 'application'
  | 'hardware'
  | 'setup'
  | 'test'
  | 'customer'
  | 'provider'
  | 'other';

export const ACTIVATION_BLOCKER_CATEGORY_LABELS: Record<ActivationBlockerCategory, string> = {
  documents: 'Unterlagen',
  application: 'Antrag',
  hardware: 'Hardware',
  setup: 'Einrichtung',
  test: 'Test',
  customer: 'Kunde',
  provider: 'Anbieter',
  other: 'Sonstiges',
};

export type ActivationBlockerSeverity = 'note' | 'warning' | 'hard';

export const ACTIVATION_BLOCKER_SEVERITY_LABELS: Record<ActivationBlockerSeverity, string> = {
  note: 'Hinweis',
  warning: 'Warnung',
  hard: 'Hart (blockiert Go-live)',
};

export type ActivationBlockerStatus = 'open' | 'resolved';

export const ACTIVATION_BLOCKER_STATUS_LABELS: Record<ActivationBlockerStatus, string> = {
  open: 'Offen',
  resolved: 'Gelöst',
};

export interface ActivationBlocker {
  id: string;
  schemaVersion: number;
  activationId: string;
  category: ActivationBlockerCategory;
  severity: ActivationBlockerSeverity;
  status: ActivationBlockerStatus;
  title: string;
  description: string;
  relatedHardwareId: string | null;
  relatedApplicationId: string | null;
  relatedChecklistItemId: string | null;
  createdAt: string;
  createdByUserId: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  resolutionNote: string;
}
