import type { UserRole } from '../user/user';

/** Zentrale fachliche Berechtigungen für B04 */
export type Permission =
  | 'leads.view'
  | 'leads.view_team'
  | 'leads.create'
  | 'leads.edit'
  | 'leads.change_status'
  | 'tasks.create'
  | 'tasks.assign'
  | 'team.view'
  | 'activities.view'
  | 'notes.create'
  | 'calculator.create'
  | 'calculator.view_team'
  | 'wizard.start'
  | 'wizard.resume_team'
  | 'commission.view'
  | 'offers.create'
  | 'offers.edit_own'
  | 'offers.edit_team'
  | 'offers.new_version'
  | 'offers.request_approval'
  | 'offers.approve'
  | 'offers.request_changes'
  | 'offers.document_sent'
  | 'offers.accept'
  | 'offers.decline'
  | 'offers.activate'
  | 'offers.commission_release'
  | 'offers.commission_status'
  | 'contracts.view_own'
  | 'contracts.view_team'
  | 'contracts.create'
  | 'contracts.change'
  | 'contracts.change_approve'
  | 'contracts.terminate'
  | 'contracts.extend'
  | 'contracts.suspend'
  | 'contracts.activate'
  | 'contracts.documents'
  | 'contracts.provision'
  | 'contracts.audit'
  | 'activations.view_own'
  | 'activations.view_team'
  | 'activations.create'
  | 'activations.update'
  | 'activations.documents'
  | 'activations.applications'
  | 'activations.hardware'
  | 'activations.setup'
  | 'activations.test'
  | 'activations.go_live'
  | 'activations.blockers'
  | 'activations.complete'
  | 'activations.cancel'
  | 'activations.audit'
  | 'admin.access'
  | 'admin.users'
  | 'admin.roles'
  | 'admin.tariffs'
  | 'admin.price_books'
  | 'admin.products'
  | 'admin.commission'
  | 'admin.approval_rules'
  | 'admin.templates'
  | 'admin.export'
  | 'admin.backup'
  | 'admin.audit'
  | 'admin.system';

export const PERMISSION_LABELS: Record<Permission, string> = {
  'leads.view': 'Leads sehen',
  'leads.view_team': 'Fremde Leads sehen',
  'leads.create': 'Lead anlegen',
  'leads.edit': 'Lead ändern',
  'leads.change_status': 'Leadstatus ändern',
  'tasks.create': 'Aufgaben anlegen',
  'tasks.assign': 'Aufgaben zuweisen',
  'team.view': 'Teamansicht',
  'activities.view': 'Aktivitäten sehen',
  'notes.create': 'Interne Notizen anlegen',
  'calculator.create': 'Berechnungen anlegen',
  'calculator.view_team': 'Fremde Berechnungen sehen',
  'wizard.start': 'Wizard starten',
  'wizard.resume_team': 'Fremden Wizard fortsetzen',
  'commission.view': 'Provision sehen',
  'offers.create': 'Angebot anlegen',
  'offers.edit_own': 'Eigenes Angebot ändern',
  'offers.edit_team': 'Fremdes Angebot ändern',
  'offers.new_version': 'Neue Version erstellen',
  'offers.request_approval': 'Freigabe anfordern',
  'offers.approve': 'Freigeben',
  'offers.request_changes': 'Änderungen anfordern',
  'offers.document_sent': 'Versand dokumentieren',
  'offers.accept': 'Annahme dokumentieren',
  'offers.decline': 'Ablehnung dokumentieren',
  'offers.activate': 'Aktivierung dokumentieren',
  'offers.commission_release': 'Provision freigeben',
  'offers.commission_status': 'Provisionsstatus ändern',
  'contracts.view_own': 'Eigene Verträge sehen',
  'contracts.view_team': 'Teamverträge sehen',
  'contracts.create': 'Vertrag anlegen',
  'contracts.change': 'Vertragsänderung starten',
  'contracts.change_approve': 'Vertragsänderung freigeben',
  'contracts.terminate': 'Kündigung erfassen',
  'contracts.extend': 'Vertrag verlängern',
  'contracts.suspend': 'Vertrag sperren',
  'contracts.activate': 'Vertragsaktivierung steuern',
  'contracts.documents': 'Vertragsdokumente verwalten',
  'contracts.provision': 'Vertragsprovision sehen',
  'contracts.audit': 'Vertragsaudit sehen',
  'activations.view_own': 'Eigene Aktivierungen sehen',
  'activations.view_team': 'Teamaktivierungen sehen',
  'activations.create': 'Aktivierung starten',
  'activations.update': 'Aktivierung bearbeiten',
  'activations.documents': 'Aktivierungsdokumente verwalten',
  'activations.applications': 'Anträge verwalten',
  'activations.hardware': 'Hardware verwalten',
  'activations.setup': 'Einrichtung dokumentieren',
  'activations.test': 'Testzahlung dokumentieren',
  'activations.go_live': 'Go-live bestätigen',
  'activations.blockers': 'Blocker verwalten',
  'activations.complete': 'Aktivierung abschließen',
  'activations.cancel': 'Aktivierung abbrechen',
  'activations.audit': 'Aktivierungsaudit sehen',
  'admin.access': 'Administration öffnen',
  'admin.users': 'Benutzer verwalten',
  'admin.roles': 'Rollen und Rechte verwalten',
  'admin.tariffs': 'Tarife verwalten',
  'admin.price_books': 'Preislisten verwalten',
  'admin.products': 'Produkte verwalten',
  'admin.commission': 'Provisionsmodelle verwalten',
  'admin.approval_rules': 'Freigaberegeln verwalten',
  'admin.templates': 'Vorlagen verwalten',
  'admin.export': 'Exporte durchführen',
  'admin.backup': 'Sicherungen erstellen',
  'admin.audit': 'Audit einsehen',
  'admin.system': 'Systemdiagnose einsehen',
};

/** Außendienst: eigene Kundenfälle, ohne Verwaltung und ohne Team-/Freigabe-Rechte. */
const FIELD_SERVICE_PERMISSIONS: Permission[] = [
  'leads.view',
  'leads.create',
  'leads.edit',
  'leads.change_status',
  'tasks.create',
  'activities.view',
  'notes.create',
  'calculator.create',
  'wizard.start',
  'offers.create',
  'offers.edit_own',
  'offers.new_version',
  'offers.request_approval',
  'offers.document_sent',
  'offers.accept',
  'offers.decline',
  'offers.activate',
  'contracts.view_own',
  'contracts.create',
  'contracts.change',
  'contracts.terminate',
  'contracts.documents',
  'activations.view_own',
  'activations.create',
  'activations.update',
  'activations.documents',
  'activations.applications',
  'activations.hardware',
  'activations.setup',
  'activations.test',
  'activations.blockers',
];

const ADMIN_PERMISSIONS: Permission[] = Object.keys(PERMISSION_LABELS) as Permission[];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  field_service: FIELD_SERVICE_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function isAdminRole(role: UserRole): boolean {
  return role === 'admin';
}

/** Historisch: Read-only-Rolle existiert nicht mehr. */
export function isReadOnlyRole(_role: UserRole): boolean {
  return false;
}

export function canMutate(_role: UserRole): boolean {
  return true;
}
