export const CURRENT_ACTIVATION_CHECKLIST_SCHEMA_VERSION = 1;

export type ActivationChecklistCategory =
  | 'stammdaten'
  | 'vertragspruefung'
  | 'unterlagen'
  | 'haendlerantrag'
  | 'acquiring'
  | 'hardware'
  | 'versand'
  | 'einrichtung'
  | 'test'
  | 'go_live'
  | 'abschluss'
  | 'uebergabe';

export const ACTIVATION_CHECKLIST_CATEGORY_LABELS: Record<ActivationChecklistCategory, string> = {
  stammdaten: 'Stammdaten',
  vertragspruefung: 'Vertragsprüfung',
  unterlagen: 'Unterlagen',
  haendlerantrag: 'Händlerantrag',
  acquiring: 'Acquiring',
  hardware: 'Hardware',
  versand: 'Versand',
  einrichtung: 'Einrichtung',
  test: 'Test',
  go_live: 'Go-live',
  abschluss: 'Abschluss',
  uebergabe: 'Übergabe',
};

export const ACTIVATION_CHECKLIST_CATEGORY_ORDER: ActivationChecklistCategory[] = [
  'stammdaten',
  'vertragspruefung',
  'unterlagen',
  'haendlerantrag',
  'acquiring',
  'hardware',
  'versand',
  'einrichtung',
  'test',
  'go_live',
  'abschluss',
  'uebergabe',
];

export type ActivationChecklistItemStatus = 'open' | 'in_progress' | 'done' | 'not_applicable' | 'blocked';

export const ACTIVATION_CHECKLIST_ITEM_STATUS_LABELS: Record<ActivationChecklistItemStatus, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  done: 'Erledigt',
  not_applicable: 'Entfällt',
  blocked: 'Blockiert',
};

export interface ActivationChecklistItem {
  id: string;
  schemaVersion: number;
  activationId: string;
  category: ActivationChecklistCategory;
  /** Stable key within the case, e.g. `hardware_delivery_1` – used for dependency edges. */
  key: string;
  title: string;
  description: string;
  status: ActivationChecklistItemStatus;
  required: boolean;
  evidenceRequired: boolean;
  documentId: string | null;
  /** Keys of other items in the same activation that must be done first. */
  dependsOnKeys: string[];
  sortOrder: number;
  note: string;
  /** Stable key for idempotent creation from the template, e.g. activation:{id}:checklist:{category}:{key} */
  sourceKey: string;
  completedAt: string | null;
  completedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}
