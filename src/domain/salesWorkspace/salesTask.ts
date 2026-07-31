export const SALES_TASK_SCHEMA_VERSION = 1;

export type SalesTaskType =
  | 'callback'
  | 'request_billing'
  | 'review_billing'
  | 'continue_calculation'
  | 'prepare_offer'
  | 'review_approval'
  | 'follow_up_offer'
  | 'check_activation'
  | 'check_commission'
  | 'general'
  | 'review_contract'
  | 'prepare_contract_change'
  | 'review_tariff_change'
  | 'execute_hardware_change'
  | 'prepare_renewal'
  | 'check_termination_deadline'
  | 'process_termination'
  | 'winback'
  | 'close_contract'
  | 'request_contract_document';

export type SalesTaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

export type SalesTaskPriority = 'normal' | 'high' | 'urgent';

export type SalesTaskOrigin = 'manual' | 'automatic' | 'system';

export const SALES_TASK_TYPE_LABELS: Record<SalesTaskType, string> = {
  callback: 'Rückruf',
  request_billing: 'Abrechnung anfordern',
  review_billing: 'Abrechnung prüfen',
  continue_calculation: 'Berechnung fortsetzen',
  prepare_offer: 'Angebot vorbereiten',
  review_approval: 'Freigabe prüfen',
  follow_up_offer: 'Angebot nachfassen',
  check_activation: 'Aktivierung prüfen',
  check_commission: 'Provision prüfen',
  general: 'Allgemeine Aufgabe',
  review_contract: 'Vertragsprüfung',
  prepare_contract_change: 'Vertragsänderung vorbereiten',
  review_tariff_change: 'Tarifwechsel prüfen',
  execute_hardware_change: 'Hardwareänderung durchführen',
  prepare_renewal: 'Verlängerung vorbereiten',
  check_termination_deadline: 'Kündigungsfrist prüfen',
  process_termination: 'Kündigung bearbeiten',
  winback: 'Rückgewinnung',
  close_contract: 'Vertragsende abschließen',
  request_contract_document: 'Dokument nachfordern',
};

export const SALES_TASK_STATUS_LABELS: Record<SalesTaskStatus, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  done: 'Erledigt',
  cancelled: 'Abgebrochen',
};

export const SALES_TASK_PRIORITY_LABELS: Record<SalesTaskPriority, string> = {
  normal: 'Normal',
  high: 'Hoch',
  urgent: 'Dringend',
};

export interface SalesTask {
  id: string;
  schemaVersion: number;
  title: string;
  description: string;
  type: SalesTaskType;
  status: SalesTaskStatus;
  priority: SalesTaskPriority;
  dueAt: string | null;
  dueTimeLocal: string | null;
  assigneeUserId: string;
  createdByUserId: string;
  completedAt: string | null;
  completedByUserId: string | null;
  completionNote: string;
  leadId: string | null;
  comparisonSessionId: string | null;
  offerId: string | null;
  contractId: string | null;
  contractVersionId: string | null;
  wizardEnabled: boolean;
  origin: SalesTaskOrigin;
  /** Stable key for automatic/idempotent tasks, e.g. auto:continue_calculation:session_xyz */
  sourceKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSalesTaskInput {
  title: string;
  description?: string;
  type: SalesTaskType;
  priority?: SalesTaskPriority;
  dueAt?: string | null;
  dueTimeLocal?: string | null;
  assigneeUserId?: string;
  leadId?: string | null;
  comparisonSessionId?: string | null;
  offerId?: string | null;
  contractId?: string | null;
  contractVersionId?: string | null;
  wizardEnabled?: boolean;
  origin?: SalesTaskOrigin;
  sourceKey?: string | null;
}

export interface UpdateSalesTaskInput {
  title?: string;
  description?: string;
  type?: SalesTaskType;
  status?: SalesTaskStatus;
  priority?: SalesTaskPriority;
  dueAt?: string | null;
  dueTimeLocal?: string | null;
  assigneeUserId?: string;
  leadId?: string | null;
  comparisonSessionId?: string | null;
  offerId?: string | null;
  contractId?: string | null;
  contractVersionId?: string | null;
  completionNote?: string;
}
