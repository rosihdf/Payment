import type { OfferItem, OfferTariffSnapshot } from './offer';
import type { OfferContractModel } from './offerContractModel';

export interface OfferTerminalSnapshot {
  terminalCount: number;
  optionalTerminalCount: number;
  terminalLines: OfferItem[];
  accessoryLines: OfferItem[];
}

export function deriveTerminalSnapshot(items: OfferItem[]): OfferTerminalSnapshot {
  const terminalLines = items.filter((item) => item.productSnapshot?.category === 'payment_terminal');
  const accessoryLines = items.filter((item) => item.productSnapshot?.category === 'accessory');
  return {
    terminalCount: terminalLines
      .filter((item) => item.priceType !== 'on_request')
      .reduce((total, item) => total + Math.max(0, item.quantity), 0),
    optionalTerminalCount: terminalLines
      .filter((item) => item.priceType === 'on_request')
      .reduce((total, item) => total + Math.max(0, item.quantity), 0),
    terminalLines,
    accessoryLines,
  };
}

export function deriveContractModel(
  items: OfferItem[],
  tariff: OfferTariffSnapshot | null,
): OfferContractModel {
  const terminal = deriveTerminalSnapshot(items);
  if (!tariff && terminal.terminalCount + terminal.optionalTerminalCount === 0) return 'not_specified';
  if (terminal.terminalCount + terminal.optionalTerminalCount === 0) return 'acq_only';
  if (!tariff) return 'not_specified';
  const hasRental = terminal.terminalLines.some((item) => item.priceType === 'monthly');
  const hasPurchase = terminal.terminalLines.some((item) => item.priceType === 'one_time');
  if (hasRental && !hasPurchase) return 'rental';
  if (hasPurchase && !hasRental) return 'purchase';
  return 'terminal_plus_acq';
}
