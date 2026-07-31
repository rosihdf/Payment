export const SALES_ACTIVITY_SCHEMA_VERSION = 1;

export type SalesActivityType =
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'status_change'
  | 'billing_requested'
  | 'billing_imported'
  | 'calculation_created'
  | 'wizard_resumed'
  | 'offer_created'
  | 'offer_sent'
  | 'approval_requested'
  | 'approval_completed'
  | 'offer_accepted'
  | 'task_created'
  | 'task_completed'
  | 'activation'
  | 'commission';

export const SALES_ACTIVITY_TYPE_LABELS: Record<SalesActivityType, string> = {
  note: 'Notiz',
  call: 'Telefonat',
  email: 'E-Mail',
  meeting: 'Termin',
  status_change: 'Statusänderung',
  billing_requested: 'Abrechnung angefordert',
  billing_imported: 'Abrechnung importiert',
  calculation_created: 'Berechnung erstellt',
  wizard_resumed: 'Vertriebsprozess fortgesetzt',
  offer_created: 'Angebot erstellt',
  offer_sent: 'Angebot versendet',
  approval_requested: 'Freigabe angefordert',
  approval_completed: 'Freigabe erfolgt',
  offer_accepted: 'Angebot angenommen',
  task_created: 'Aufgabe erstellt',
  task_completed: 'Aufgabe erledigt',
  activation: 'Aktivierung',
  commission: 'Provision',
};

export interface SalesActivity {
  id: string;
  schemaVersion: number;
  type: SalesActivityType;
  title: string;
  description: string;
  occurredAt: string;
  createdByUserId: string;
  leadId: string | null;
  comparisonSessionId: string | null;
  offerId: string | null;
  taskId: string | null;
  isSystem: boolean;
  editable: boolean;
  /** Stable key for idempotent system activities */
  sourceKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSalesActivityInput {
  type: SalesActivityType;
  title: string;
  description?: string;
  occurredAt?: string;
  leadId?: string | null;
  comparisonSessionId?: string | null;
  offerId?: string | null;
  taskId?: string | null;
  isSystem?: boolean;
  editable?: boolean;
  sourceKey?: string | null;
}
