/**
 * Explizite PPT-Vertragskonstellationen – keine addierbaren Provisionselemente.
 * Operative Wahrheit: Provisionsodell.pptx (Fachentscheidung Auftraggeber Phase 2D).
 */

export type CommissionContractConfiguration =
  | 'terminal_acq_long_term'
  | 'terminal_short_term'
  | 'acq_only';

export type CommissionContractTermClass = 'short_term' | 'long_term' | 'unknown';

/** >=36 abgeschlossene Monate = long_term (Fachentscheidung Auftraggeber). */
export function classifyCommissionContractTerm(
  termMonths: number | null,
): CommissionContractTermClass {
  if (termMonths === null || !Number.isInteger(termMonths) || termMonths < 1) {
    return 'unknown';
  }

  if (termMonths >= 36) {
    return 'long_term';
  }

  return 'short_term';
}

const LEGACY_CONTRACT_TYPE_MAP: Record<string, CommissionContractConfiguration | 'legacy_unresolved'> =
  {
    terminal_plus_acq: 'terminal_acq_long_term',
    terminal_only: 'terminal_short_term',
    acq_only: 'acq_only',
  };

/**
 * Löst eine eindeutige Vertragskonstellation auf – ohne Terminal+ACQ-Addition.
 * Legacy contractTypeCode wird nur als Einzel-Konfiguration interpretiert.
 */
export function resolveCommissionContractConfiguration(input: {
  contractConfiguration?: CommissionContractConfiguration | null;
  contractTypeCode?: string | null;
  termMonths?: number | null;
}): CommissionContractConfiguration | null {
  if (input.contractConfiguration) {
    return input.contractConfiguration;
  }

  const termClass = classifyCommissionContractTerm(input.termMonths ?? null);
  if (termClass === 'unknown' || !input.contractTypeCode) {
    return null;
  }

  const mapped = LEGACY_CONTRACT_TYPE_MAP[input.contractTypeCode];
  if (!mapped || mapped === 'legacy_unresolved') {
    return null;
  }

  if (mapped === 'terminal_acq_long_term' && termClass !== 'long_term') {
    return null;
  }

  if (mapped === 'terminal_short_term' && termClass !== 'short_term') {
    return null;
  }

  return mapped;
}

export function contractConfigurationLabel(config: CommissionContractConfiguration): string {
  switch (config) {
    case 'terminal_acq_long_term':
      return 'Terminal + ACQ (Laufzeit >= 36 Monate)';
    case 'terminal_short_term':
      return 'Terminalvertrag (< 36 Monate)';
    case 'acq_only':
      return 'ACQ-only';
  }
}

/** Leitet die PPT-Vertragskonstellation aus einem Empfehlungskandidaten ab – ohne Addition. */
export function resolveCommissionContractConfigurationFromCandidate(input: {
  hardwareProductIds: string[];
  termMonths: number | null;
}): CommissionContractConfiguration | null {
  if (input.hardwareProductIds.length === 0) {
    return 'acq_only';
  }

  const termClass = classifyCommissionContractTerm(input.termMonths);
  if (termClass === 'long_term') {
    return 'terminal_acq_long_term';
  }
  if (termClass === 'short_term') {
    return 'terminal_short_term';
  }

  return null;
}
