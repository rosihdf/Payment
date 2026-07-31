export type DiagnosticSeverity = 'info' | 'warning' | 'error' | 'critical';

export type DiagnosticArea =
  | 'lead'
  | 'offer'
  | 'offer_version'
  | 'workflow_event'
  | 'document'
  | 'task'
  | 'activity'
  | 'user'
  | 'tariff'
  | 'product'
  | 'commission'
  | 'storage'
  | 'contract'
  | 'contract_version'
  | 'contract_termination';

export interface DiagnosticFinding {
  id: string;
  severity: DiagnosticSeverity;
  area: DiagnosticArea;
  entityId: string;
  description: string;
  recommendedAction: string;
  autoRepairable: boolean;
  repairKey: string | null;
}

export const DIAGNOSTIC_SEVERITY_LABELS: Record<DiagnosticSeverity, string> = {
  info: 'Hinweis',
  warning: 'Warnung',
  error: 'Fehler',
  critical: 'Kritisch',
};
