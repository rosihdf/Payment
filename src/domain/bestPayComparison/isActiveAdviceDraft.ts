import type { BestPayComparisonSession } from './bestPayComparisonSession';

/**
 * Aktiver Beratungsentwurf: Wizard offen, kein Angebot, nicht verworfen/archiviert.
 * Entspricht der Workspace-Liste „Beratung fortsetzen“.
 */
export function isActiveAdviceDraft(session: BestPayComparisonSession): boolean {
  if (session.status === 'discarded' || session.status === 'offer_created') {
    return false;
  }
  if (session.archivedAt || session.offerId) {
    return false;
  }
  if (session.wizard.wizardCompletedAt) {
    return false;
  }
  if (!(session.entryMode === 'wizard' || session.wizard.enabled)) {
    return false;
  }
  return true;
}

export function isActiveAdviceDraftForLead(
  session: BestPayComparisonSession,
  leadId: string,
): boolean {
  return session.leadId === leadId && isActiveAdviceDraft(session);
}

export function pickLatestActiveAdviceDraft(
  sessions: BestPayComparisonSession[],
): BestPayComparisonSession | null {
  return (
    [...sessions]
      .filter(isActiveAdviceDraft)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  );
}
