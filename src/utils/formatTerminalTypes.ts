import { TERMINAL_TYPE_LABELS, type TerminalType } from '../domain/tariff/tariff';

export function formatTerminalTypes(types: TerminalType[]): string {
  if (types.length === 0) {
    return 'Keine';
  }

  return types.map((type) => TERMINAL_TYPE_LABELS[type]).join(', ');
}
