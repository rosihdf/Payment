import type { Lead } from './lead';
import type { UserRole } from '../user/user';

/** Gemeinsamer Sichtbarkeitskontext für Kunden. */
export interface LeadVisibilityContext {
  userId: string;
  role: UserRole;
}

/**
 * Verbindliche Kundensichtbarkeit:
 * - Admin: alle Kunden
 * - Außendienst: nur zugewiesene Kunden (assignedSalesUserId)
 * Kein Zugriff über createdByUserId, Team oder Mandant.
 */
export function canUserAccessLead(
  lead: Pick<Lead, 'assignedSalesUserId'>,
  context: LeadVisibilityContext,
): boolean {
  if (context.role === 'admin') {
    return true;
  }
  return Boolean(lead.assignedSalesUserId) && lead.assignedSalesUserId === context.userId;
}

export function filterLeadsByVisibility<T extends Pick<Lead, 'assignedSalesUserId'>>(
  leads: T[],
  context: LeadVisibilityContext | undefined,
): T[] {
  if (!context || context.role === 'admin') {
    return leads;
  }
  return leads.filter((lead) => canUserAccessLead(lead, context));
}

export function canUserAssignLeadAdvisor(context: LeadVisibilityContext): boolean {
  return context.role === 'admin';
}

/** Anzeige für leere/fehlende Betreuerzuweisung. */
export function getAdvisorDisplayLabel(
  assignedSalesUserId: string | null | undefined,
  resolveName: (userId: string) => string | null | undefined,
): string {
  const trimmed = assignedSalesUserId?.trim() ?? '';
  if (!trimmed) {
    return 'Noch nicht zugewiesen';
  }
  return resolveName(trimmed)?.trim() || 'Unbekannt';
}
