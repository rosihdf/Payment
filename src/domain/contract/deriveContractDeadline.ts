import type { Contract } from './contract';

export function deriveContractNextDeadline(
  contract: Pick<
    Contract,
    'earliestTerminationDate' | 'endDate' | 'plannedChangeAt'
  >,
): { at: string | null; label: string | null } {
  const candidates: Array<{ at: string; label: string }> = [];
  if (contract.earliestTerminationDate) {
    candidates.push({ at: contract.earliestTerminationDate, label: 'Kündigungsfrist' });
  }
  if (contract.endDate) {
    candidates.push({ at: contract.endDate, label: 'Vertragsende' });
  }
  if (contract.plannedChangeAt) {
    candidates.push({ at: contract.plannedChangeAt, label: 'Geplante Änderung' });
  }
  candidates.sort((a, b) => a.at.localeCompare(b.at));
  const next = candidates[0];
  return next ? { at: next.at, label: next.label } : { at: null, label: null };
}
