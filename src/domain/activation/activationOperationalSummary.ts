import type { ActivationCase } from './activationCase';
import type { ActivationStatus } from './activationStatus';

/** Kompakte operative Statusanzeige für Angebot/Vertrag/Kunde (keine zweite Persistenz). */
export type OperationalActivationSummary =
  | 'not_started'
  | 'running'
  | 'blocked'
  | 'live'
  | 'completed'
  | 'cancelled';

export const OPERATIONAL_ACTIVATION_SUMMARY_LABELS: Record<OperationalActivationSummary, string> = {
  not_started: 'nicht gestartet',
  running: 'läuft',
  blocked: 'blockiert',
  live: 'live',
  completed: 'abgeschlossen',
  cancelled: 'abgebrochen',
};

const COMPLETED: ActivationStatus[] = ['completed', 'archived'];

export function deriveOperationalActivationSummary(
  activation: Pick<ActivationCase, 'status'> | null | undefined,
): OperationalActivationSummary {
  if (!activation) {
    return 'not_started';
  }
  if (activation.status === 'blocked') {
    return 'blocked';
  }
  if (activation.status === 'live') {
    return 'live';
  }
  if (COMPLETED.includes(activation.status)) {
    return 'completed';
  }
  if (activation.status === 'cancelled') {
    return 'cancelled';
  }
  return 'running';
}
