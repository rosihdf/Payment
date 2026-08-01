import type { ContractStatus } from '../../domain/contract/contractStatus';
import { CONTRACT_STATUS_LABELS } from '../../domain/contract/contractStatus';

/** Sichtbare Statusgruppe – nur Anzeige, keine Persistenz. */
export type ContractDisplayGroup =
  | 'preparation'
  | 'activation'
  | 'active'
  | 'change_or_termination'
  | 'ended'
  | 'archived';

export const CONTRACT_DISPLAY_GROUP_LABELS: Record<ContractDisplayGroup, string> = {
  preparation: 'Vorbereitung',
  activation: 'Aktivierung',
  active: 'Aktiv',
  change_or_termination: 'Änderung oder Kündigung',
  ended: 'Beendet',
  archived: 'Archiviert',
};

const STATUS_TO_GROUP: Record<ContractStatus, ContractDisplayGroup> = {
  preparation: 'preparation',
  activation: 'activation',
  active: 'active',
  suspended: 'change_or_termination',
  termination_pending: 'change_or_termination',
  expiring: 'change_or_termination',
  terminated: 'ended',
  ended: 'ended',
  cancelled_before_start: 'ended',
  archived: 'archived',
};

export function getContractDisplayGroup(status: ContractStatus): ContractDisplayGroup {
  return STATUS_TO_GROUP[status];
}

export function getContractDisplayLabel(status: ContractStatus): string {
  return CONTRACT_DISPLAY_GROUP_LABELS[getContractDisplayGroup(status)];
}

export function getContractTechnicalLabel(status: ContractStatus): string {
  return CONTRACT_STATUS_LABELS[status];
}
