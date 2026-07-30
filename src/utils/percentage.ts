const percentFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function basisPointsToPercent(basisPoints: number): number {
  return basisPoints / 100;
}

export function percentToBasisPoints(percent: number): number {
  return Math.round(percent * 100);
}

export function formatBasisPointsToPercent(basisPoints: number): string {
  return `${percentFormatter.format(basisPointsToPercent(basisPoints))} %`;
}

export function parsePercentToBasisPoints(input: string): number | null {
  const trimmed = input.trim().replace(/%/g, '').replace(/\s/g, '');

  if (!trimmed) {
    return 0;
  }

  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);

  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }

  return percentToBasisPoints(parsed);
}

export function isValidBasisPoints(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 10000;
}
