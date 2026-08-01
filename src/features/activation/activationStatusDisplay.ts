import type { ActivationStatus } from '../../domain/activation/activationStatus';
import { ACTIVATION_STATUS_LABELS } from '../../domain/activation/activationStatus';

/** Sichtbare Statusgruppe – nur Anzeige, keine Persistenz. */
export type ActivationDisplayGroup =
  | 'preparation'
  | 'documents_review'
  | 'hardware'
  | 'setup_test'
  | 'go_live'
  | 'live'
  | 'blocked'
  | 'closed';

export const ACTIVATION_DISPLAY_GROUP_LABELS: Record<ActivationDisplayGroup, string> = {
  preparation: 'Vorbereitung',
  documents_review: 'Unterlagen & Prüfung',
  hardware: 'Hardware',
  setup_test: 'Einrichtung & Test',
  go_live: 'Go-live',
  live: 'Produktiv',
  blocked: 'Blockiert',
  closed: 'Beendet',
};

const STATUS_TO_GROUP: Record<ActivationStatus, ActivationDisplayGroup> = {
  draft: 'preparation',
  preparation: 'preparation',
  documents_pending: 'documents_review',
  application_pending: 'documents_review',
  provider_review: 'documents_review',
  hardware_pending: 'hardware',
  setup_pending: 'setup_test',
  testing: 'setup_test',
  go_live_ready: 'go_live',
  live: 'live',
  blocked: 'blocked',
  cancelled: 'closed',
  completed: 'closed',
  archived: 'closed',
};

export function getActivationDisplayGroup(status: ActivationStatus): ActivationDisplayGroup {
  return STATUS_TO_GROUP[status];
}

export function getActivationDisplayLabel(status: ActivationStatus): string {
  return ACTIVATION_DISPLAY_GROUP_LABELS[getActivationDisplayGroup(status)];
}

export function getActivationTechnicalLabel(status: ActivationStatus): string {
  return ACTIVATION_STATUS_LABELS[status];
}

export function getActivationPrimaryActionLabel(status: ActivationStatus): string | null {
  switch (status) {
    case 'draft':
      return 'In Vorbereitung setzen';
    case 'go_live_ready':
      return 'Go-live bestätigen';
    case 'live':
      return 'Abschließen';
    case 'completed':
      return 'Übergabe bestätigen';
    case 'blocked':
      return null;
    default:
      return null;
  }
}
