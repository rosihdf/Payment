import type { OfferVersion, OfferVersionDiffEntry } from './offerVersion';

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '–';
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function compareOfferVersions(before: OfferVersion, after: OfferVersion): OfferVersionDiffEntry[] {
  const fields: Array<[keyof OfferVersion['snapshot'], string, boolean]> = [
    ['title', 'Titel', false],
    ['validUntil', 'Gültig bis', true],
    ['customerSnapshot', 'Kundendaten', true],
    ['tariffSnapshot', 'Tarif', true],
    ['items', 'Positionen', true],
    ['totals', 'Summen', true],
    ['introductionText', 'Einleitung', false],
    ['customerNotes', 'Kundenhinweise', false],
    ['internalNotes', 'Interne Hinweise', true],
  ];
  return fields.flatMap(([field, label, approvalRelevant]) => {
    const left = display(before.snapshot[field]);
    const right = display(after.snapshot[field]);
    return left === right ? [] : [{ field, label, before: left, after: right, approvalRelevant }];
  });
}
