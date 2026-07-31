export type ActivationStatus =
  | 'draft'
  | 'preparation'
  | 'documents_pending'
  | 'application_pending'
  | 'provider_review'
  | 'hardware_pending'
  | 'setup_pending'
  | 'testing'
  | 'go_live_ready'
  | 'live'
  | 'blocked'
  | 'cancelled'
  | 'completed'
  | 'archived';

export const ACTIVATION_STATUS_LABELS: Record<ActivationStatus, string> = {
  draft: 'Entwurf',
  preparation: 'Vorbereitung',
  documents_pending: 'Unterlagen offen',
  application_pending: 'Antrag offen',
  provider_review: 'Prüfung Anbieter',
  hardware_pending: 'Hardware offen',
  setup_pending: 'Einrichtung offen',
  testing: 'Testphase',
  go_live_ready: 'Bereit für Go-live',
  live: 'Live',
  blocked: 'Blockiert',
  cancelled: 'Abgebrochen',
  completed: 'Abgeschlossen',
  archived: 'Archiviert',
};

export const ACTIVATION_STATUSES: ActivationStatus[] = [
  'draft',
  'preparation',
  'documents_pending',
  'application_pending',
  'provider_review',
  'hardware_pending',
  'setup_pending',
  'testing',
  'go_live_ready',
  'live',
  'blocked',
  'cancelled',
  'completed',
  'archived',
];

/** Non-blocked statuses in the normal operational flow, used to restore a status when a blocker is resolved. */
export const ACTIVATION_ACTIVE_FLOW_STATUSES: ActivationStatus[] = [
  'draft',
  'preparation',
  'documents_pending',
  'application_pending',
  'provider_review',
  'hardware_pending',
  'setup_pending',
  'testing',
  'go_live_ready',
];

const ALLOWED_TRANSITIONS: Record<ActivationStatus, ActivationStatus[]> = {
  draft: ['preparation', 'cancelled'],
  preparation: [
    'documents_pending',
    'application_pending',
    'hardware_pending',
    'setup_pending',
    'blocked',
    'cancelled',
  ],
  documents_pending: [
    'application_pending',
    'provider_review',
    'hardware_pending',
    'setup_pending',
    'blocked',
    'cancelled',
  ],
  application_pending: ['provider_review', 'documents_pending', 'blocked', 'cancelled'],
  provider_review: ['hardware_pending', 'setup_pending', 'application_pending', 'blocked', 'cancelled'],
  hardware_pending: ['setup_pending', 'testing', 'blocked', 'cancelled'],
  setup_pending: ['testing', 'hardware_pending', 'blocked', 'cancelled'],
  testing: ['go_live_ready', 'setup_pending', 'blocked', 'cancelled'],
  go_live_ready: ['live', 'testing', 'blocked', 'cancelled'],
  live: ['completed', 'blocked'],
  blocked: [...ACTIVATION_ACTIVE_FLOW_STATUSES, 'live', 'cancelled'],
  cancelled: ['archived'],
  completed: ['archived'],
  archived: [],
};

export function canTransitionActivationStatus(from: ActivationStatus, to: ActivationStatus): boolean {
  if (from === to) {
    return true;
  }
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedActivationStatusTransitions(from: ActivationStatus): ActivationStatus[] {
  return [...(ALLOWED_TRANSITIONS[from] ?? [])];
}

export function isTerminalActivationStatus(status: ActivationStatus): boolean {
  return status === 'completed' || status === 'archived' || status === 'cancelled';
}

export function isOperationalActivationStatus(status: ActivationStatus): boolean {
  return !isTerminalActivationStatus(status) && status !== 'live';
}
