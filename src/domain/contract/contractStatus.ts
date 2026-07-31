export type ContractStatus =
  | 'preparation'
  | 'activation'
  | 'active'
  | 'suspended'
  | 'termination_pending'
  | 'expiring'
  | 'terminated'
  | 'ended'
  | 'archived'
  | 'cancelled_before_start';

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  preparation: 'Vorbereitung',
  activation: 'Aktivierung',
  active: 'Aktiv',
  suspended: 'Gesperrt',
  termination_pending: 'Kündigung vorgemerkt',
  expiring: 'Auslaufend',
  terminated: 'Gekündigt',
  ended: 'Beendet',
  archived: 'Archiviert',
  cancelled_before_start: 'Vor Start storniert',
};

export const CONTRACT_STATUSES: ContractStatus[] = [
  'preparation',
  'activation',
  'active',
  'suspended',
  'termination_pending',
  'expiring',
  'terminated',
  'ended',
  'archived',
  'cancelled_before_start',
];

const ALLOWED_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  preparation: ['activation', 'active', 'cancelled_before_start', 'suspended'],
  activation: ['active', 'suspended', 'cancelled_before_start'],
  active: ['suspended', 'termination_pending', 'expiring', 'terminated'],
  suspended: ['active', 'termination_pending', 'terminated', 'cancelled_before_start'],
  termination_pending: ['terminated', 'active', 'expiring'],
  expiring: ['active', 'termination_pending', 'terminated', 'ended'],
  terminated: ['ended'],
  ended: ['archived'],
  archived: [],
  cancelled_before_start: ['archived'],
};

export function canTransitionContractStatus(from: ContractStatus, to: ContractStatus): boolean {
  if (from === to) {
    return true;
  }
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedContractStatusTransitions(from: ContractStatus): ContractStatus[] {
  return [...(ALLOWED_TRANSITIONS[from] ?? [])];
}

export function isTerminalContractStatus(status: ContractStatus): boolean {
  return status === 'ended' || status === 'archived' || status === 'cancelled_before_start';
}
