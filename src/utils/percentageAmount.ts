import type { TenthsOfBasisPoint } from '../domain/tariff/tariff';

export function percentageOfCents(amountCents: number, basisPoints: number): number {
  if (amountCents <= 0 || basisPoints <= 0) {
    return 0;
  }

  return Math.round((amountCents * basisPoints) / 10_000);
}

export function percentageOfCentsFromTenthsOfBasisPoint(
  volumeCents: number,
  percentageTenthsOfBasisPoint: TenthsOfBasisPoint,
): number {
  if (volumeCents <= 0 || percentageTenthsOfBasisPoint <= 0) {
    return 0;
  }

  return Math.round((volumeCents * percentageTenthsOfBasisPoint) / 100_000);
}

export function effectiveRateBasisPoints(
  totalMonthlyCostsCents: number,
  totalVolumeCents: number,
): number | null {
  if (totalVolumeCents <= 0) {
    return null;
  }

  return Math.round((totalMonthlyCostsCents * 10_000) / totalVolumeCents);
}

export function effectiveRateTenthsOfBasisPoint(
  totalMonthlyCostsCents: number,
  totalVolumeCents: number,
): number | null {
  if (totalVolumeCents <= 0) {
    return null;
  }

  return Math.round((totalMonthlyCostsCents * 100_000) / totalVolumeCents);
}

export function formatEffectiveRateBasisPoints(basisPoints: number | null): string {
  if (basisPoints === null) {
    return '–';
  }

  const percentValue = basisPoints / 100;
  return `${percentValue.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  })} %`;
}

export function formatEffectiveRateTenthsOfBasisPoint(
  tenthsOfBasisPoint: number | null,
): string {
  if (tenthsOfBasisPoint === null) {
    return '–';
  }

  const percentValue = tenthsOfBasisPoint / 1000;
  return `${percentValue.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  })} %`;
}
