import type { OfferVersion, OfferVersionDiffEntry } from './offerVersion';

export type { OfferVersionDiffEntry };

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '–';
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function compareOfferVersions(before: OfferVersion, after: OfferVersion): OfferVersionDiffEntry[] {
  // Interne Notizen sind nicht versionsauslösend und nicht freigaberelevant.
  const fields: Array<[keyof OfferVersion['snapshot'], string, boolean]> = [
    ['title', 'Titel', false],
    ['validUntil', 'Gültig bis', true],
    ['customerSnapshot', 'Kundendaten', true],
    ['tariffSnapshot', 'Tarif', true],
    ['items', 'Positionen', true],
    ['totals', 'Summen', true],
    ['introductionText', 'Einleitung', false],
    ['customerNotes', 'Kundenhinweise', false],
    ['recommendationLink', 'Empfehlung', true],
    ['termMonths', 'Laufzeit', true],
    ['contractModel', 'Vertragsmodell', true],
  ];
  return fields.flatMap(([field, label, approvalRelevant]) => {
    const left = display(before.snapshot[field]);
    const right = display(after.snapshot[field]);
    return left === right ? [] : [{ field, label, before: left, after: right, approvalRelevant }];
  });
}

/**
 * Kundenrelevante Diffs steuern eine neue Angebotsversion.
 * Interne Notizen sind in compareOfferVersions bereits ausgeschlossen.
 */
export function hasCustomerRelevantVersionChanges(diffs: OfferVersionDiffEntry[]): boolean {
  return diffs.length > 0;
}

/** Freigaberelevante Diffs – steuern erneute Freigabeprüfung. */
export function hasApprovalRelevantVersionChanges(diffs: OfferVersionDiffEntry[]): boolean {
  return diffs.some((entry) => entry.approvalRelevant);
}
