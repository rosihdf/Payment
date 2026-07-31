export type AuditAction =
  | 'user_created'
  | 'user_updated'
  | 'user_deactivated'
  | 'user_reactivated'
  | 'role_changed'
  | 'tariff_created'
  | 'tariff_updated'
  | 'tariff_activated'
  | 'tariff_archived'
  | 'product_updated'
  | 'product_deactivated'
  | 'commission_updated'
  | 'commission_activated'
  | 'approval_rule_changed'
  | 'template_activated'
  | 'export'
  | 'backup'
  | 'restore_preview'
  | 'migration'
  | 'diagnostic_repair'
  | 'contract_created'
  | 'contract_status_changed'
  | 'contract_version_created'
  | 'contract_version_activated'
  | 'contract_termination_recorded'
  | 'contract_termination_confirmed';

export type AuditEntityType =
  | 'user'
  | 'tariff'
  | 'product'
  | 'commission_plan'
  | 'approval_rule'
  | 'template'
  | 'export'
  | 'backup'
  | 'system'
  | 'contract'
  | 'contract_version'
  | 'contract_termination';

export interface AuditChangeField {
  field: string;
  before: string | null;
  after: string | null;
}

export interface AuditEntry {
  id: string;
  schemaVersion: number;
  timestamp: string;
  userId: string;
  userDisplayName: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityVersion: string | null;
  summary: string;
  changes: AuditChangeField[];
  source: 'admin' | 'system' | 'migration';
}

export const AUDIT_ENTRY_SCHEMA_VERSION = 1;

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  user_created: 'Benutzer angelegt',
  user_updated: 'Benutzer geändert',
  user_deactivated: 'Benutzer deaktiviert',
  user_reactivated: 'Benutzer reaktiviert',
  role_changed: 'Rolle geändert',
  tariff_created: 'Tarif erstellt',
  tariff_updated: 'Tarif geändert',
  tariff_activated: 'Tarif aktiviert',
  tariff_archived: 'Tarif archiviert',
  product_updated: 'Produkt geändert',
  product_deactivated: 'Produkt deaktiviert',
  commission_updated: 'Provision geändert',
  commission_activated: 'Provisionsmodell aktiviert',
  approval_rule_changed: 'Freigaberegel geändert',
  template_activated: 'Vorlage aktiviert',
  export: 'Export',
  backup: 'Sicherung',
  restore_preview: 'Restore-Vorprüfung',
  migration: 'Migration',
  diagnostic_repair: 'Diagnose-Reparatur',
  contract_created: 'Vertrag angelegt',
  contract_status_changed: 'Vertragsstatus geändert',
  contract_version_created: 'Vertragsversion erstellt',
  contract_version_activated: 'Vertragsversion aktiviert',
  contract_termination_recorded: 'Kündigung erfasst',
  contract_termination_confirmed: 'Kündigung bestätigt',
};
