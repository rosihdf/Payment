import type { ContractVersion, ContractVersionDiffEntry } from './contractVersion';
import { CONTRACT_CHANGE_REASON_LABELS } from './contractVersion';

function entry(
  field: string,
  label: string,
  before: string,
  after: string,
  category: ContractVersionDiffEntry['category'],
  approvalRelevant = false,
): ContractVersionDiffEntry | null {
  if (before === after) {
    return null;
  }
  return { field, label, before, after, category, approvalRelevant };
}

function money(cents: number | null | undefined): string {
  if (cents == null) {
    return '–';
  }
  return `${(cents / 100).toFixed(2)} €`;
}

export function compareContractVersions(
  before: ContractVersion,
  after: ContractVersion,
): ContractVersionDiffEntry[] {
  const a = before.snapshot;
  const b = after.snapshot;
  const diffs: Array<ContractVersionDiffEntry | null> = [
    entry('tariff', 'Tarif', a.tariffSnapshot?.name ?? '–', b.tariffSnapshot?.name ?? '–', 'tariff', true),
    entry('termMonths', 'Laufzeit (Monate)', String(a.termMonths ?? '–'), String(b.termMonths ?? '–'), 'term', true),
    entry('startDate', 'Vertragsbeginn', a.startDate ?? '–', b.startDate ?? '–', 'term'),
    entry('endDate', 'Vertragsende', a.endDate ?? '–', b.endDate ?? '–', 'term', true),
    entry(
      'noticePeriodMonths',
      'Kündigungsfrist (Monate)',
      String(a.noticePeriodMonths ?? '–'),
      String(b.noticePeriodMonths ?? '–'),
      'term',
    ),
    entry('contractModel', 'Vertragsmodell', a.contractModel, b.contractModel, 'model', true),
    entry(
      'customerContact',
      'Ansprechpartner',
      `${a.customerSnapshot.contactFirstName} ${a.customerSnapshot.contactLastName} / ${a.customerSnapshot.email}`,
      `${b.customerSnapshot.contactFirstName} ${b.customerSnapshot.contactLastName} / ${b.customerSnapshot.email}`,
      'customer',
    ),
    entry(
      'customerAddress',
      'Anschrift',
      `${a.customerSnapshot.street}, ${a.customerSnapshot.postalCode} ${a.customerSnapshot.city}`,
      `${b.customerSnapshot.street}, ${b.customerSnapshot.postalCode} ${b.customerSnapshot.city}`,
      'customer',
    ),
    entry(
      'terminalCount',
      'Terminalanzahl',
      String(a.terminalCount),
      String(b.terminalCount),
      'hardware',
      true,
    ),
    entry(
      'hardwareModels',
      'Hardware',
      a.hardware.map((line) => `${line.quantity}× ${line.model}`).join(', ') || '–',
      b.hardware.map((line) => `${line.quantity}× ${line.model}`).join(', ') || '–',
      'hardware',
      true,
    ),
    entry(
      'accessories',
      'Zubehör',
      a.accessoryLines.map((line) => `${line.quantity}× ${line.name}`).join(', ') || '–',
      b.accessoryLines.map((line) => `${line.quantity}× ${line.name}`).join(', ') || '–',
      'hardware',
    ),
    entry('monthlyFee', 'Monatliche Gebühren', money(a.fees.monthlyFeeCents), money(b.fees.monthlyFeeCents), 'fees', true),
    entry('setupFee', 'Einmalige Kosten', money(a.fees.setupFeeCents), money(b.fees.setupFeeCents), 'fees', true),
    entry(
      'changeReason',
      'Änderungsgrund',
      CONTRACT_CHANGE_REASON_LABELS[before.changeReason],
      CONTRACT_CHANGE_REASON_LABELS[after.changeReason],
      'other',
    ),
  ];

  return diffs.filter((value): value is ContractVersionDiffEntry => value !== null);
}

export function evaluateContractChangeApproval(
  diffs: ContractVersionDiffEntry[],
  changeReason: ContractVersion['changeReason'],
): { approvalRequired: boolean; approvalReasons: string[] } {
  const reasons = new Set<string>();
  for (const diff of diffs) {
    if (diff.approvalRelevant) {
      reasons.add(`${diff.label}: ${diff.before} → ${diff.after}`);
    }
  }
  if (
    changeReason === 'tariff_change' ||
    changeReason === 'fee_change' ||
    changeReason === 'term_extension' ||
    changeReason === 'renewal'
  ) {
    reasons.add(CONTRACT_CHANGE_REASON_LABELS[changeReason]);
  }
  return {
    approvalRequired: reasons.size > 0,
    approvalReasons: [...reasons],
  };
}
