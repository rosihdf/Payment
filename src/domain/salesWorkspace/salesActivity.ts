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
  | 'commission'
  | 'contract_created'
  | 'contract_version_created'
  | 'contract_version_activated'
  | 'contract_tariff_changed'
  | 'contract_term_changed'
  | 'contract_hardware_changed'
  | 'contract_termination_recorded'
  | 'contract_termination_confirmed'
  | 'contract_termination_withdrawn'
  | 'contract_renewal_created'
  | 'contract_suspended'
  | 'contract_reactivated'
  | 'contract_ended'
  | 'contract_document_created'
  | 'activation_started'
  | 'activation_status_changed'
  | 'activation_checklist_updated'
  | 'activation_document_requested'
  | 'activation_document_reviewed'
  | 'activation_application_created'
  | 'activation_application_submitted'
  | 'activation_application_inquiry'
  | 'activation_application_approved'
  | 'activation_application_rejected'
  | 'activation_hardware_updated'
  | 'activation_hardware_deviation'
  | 'activation_setup_updated'
  | 'activation_test_recorded'
  | 'activation_blocker_created'
  | 'activation_blocker_resolved'
  | 'activation_go_live_confirmed'
  | 'activation_go_live_revoked'
  | 'activation_completed'
  | 'activation_cancelled'
  | 'activation_handover_ready'
  | 'activation_handover_confirmed';

export const SALES_ACTIVITY_TYPE_LABELS: Record<SalesActivityType, string> = {
  note: 'Notiz',
  call: 'Telefonat',
  email: 'E-Mail',
  meeting: 'Termin',
  status_change: 'Statusänderung',
  billing_requested: 'Abrechnung angefordert',
  billing_imported: 'Abrechnung importiert',
  calculation_created: 'Berechnung erstellt',
  wizard_resumed: 'Beratung fortgesetzt',
  offer_created: 'Angebot erstellt',
  offer_sent: 'Angebot versendet',
  approval_requested: 'Freigabe angefordert',
  approval_completed: 'Freigabe erfolgt',
  offer_accepted: 'Angebot angenommen',
  task_created: 'Aufgabe angelegt',
  task_completed: 'Aufgabe erledigt',
  activation: 'Aktivierung',
  commission: 'Provision',
  contract_created: 'Vertrag erstellt',
  contract_version_created: 'Vertragsversion erstellt',
  contract_version_activated: 'Vertragsversion aktiviert',
  contract_tariff_changed: 'Tarif geändert',
  contract_term_changed: 'Laufzeit geändert',
  contract_hardware_changed: 'Hardware geändert',
  contract_termination_recorded: 'Kündigung erfasst',
  contract_termination_confirmed: 'Kündigung bestätigt',
  contract_termination_withdrawn: 'Kündigung zurückgezogen',
  contract_renewal_created: 'Verlängerung erstellt',
  contract_suspended: 'Vertrag gesperrt',
  contract_reactivated: 'Vertrag reaktiviert',
  contract_ended: 'Vertrag beendet',
  contract_document_created: 'Vertragsdokument erzeugt',
  activation_started: 'Aktivierung gestartet',
  activation_status_changed: 'Aktivierungsstatus geändert',
  activation_checklist_updated: 'Checkliste aktualisiert',
  activation_document_requested: 'Unterlage angefordert',
  activation_document_reviewed: 'Unterlage geprüft',
  activation_application_created: 'Antrag angelegt',
  activation_application_submitted: 'Antrag eingereicht',
  activation_application_inquiry: 'Rückfrage zum Antrag',
  activation_application_approved: 'Antrag genehmigt',
  activation_application_rejected: 'Antrag abgelehnt',
  activation_hardware_updated: 'Hardware aktualisiert',
  activation_hardware_deviation: 'Hardwareabweichung erfasst',
  activation_setup_updated: 'Einrichtung aktualisiert',
  activation_test_recorded: 'Testzahlung erfasst',
  activation_blocker_created: 'Blocker erfasst',
  activation_blocker_resolved: 'Blocker gelöst',
  activation_go_live_confirmed: 'Go-live bestätigt',
  activation_go_live_revoked: 'Go-live zurückgenommen',
  activation_completed: 'Aktivierung abgeschlossen',
  activation_cancelled: 'Aktivierung abgebrochen',
  activation_handover_ready: 'Übergabe vorbereitet',
  activation_handover_confirmed: 'Übergabe bestätigt',
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
  contractId: string | null;
  contractVersionId: string | null;
  activationId: string | null;
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
  contractId?: string | null;
  contractVersionId?: string | null;
  activationId?: string | null;
  taskId?: string | null;
  isSystem?: boolean;
  editable?: boolean;
  sourceKey?: string | null;
}
