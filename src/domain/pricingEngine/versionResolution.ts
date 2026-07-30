import type { PriceBookVersion } from '../pricing/priceBook';

function parseDate(value: string): Date | null {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isPriceBookVersionValidOnDate(
  version: PriceBookVersion,
  evaluationDate: string,
): boolean {
  if (version.status !== 'published') {
    return false;
  }

  const date = parseDate(evaluationDate);
  const validFrom = parseDate(version.validFrom);
  if (!date || !validFrom || date < validFrom) {
    return false;
  }

  if (version.validUntil) {
    const validUntil = parseDate(version.validUntil);
    if (!validUntil || date > validUntil) {
      return false;
    }
  }

  return true;
}

export function resolvePublishedPriceBookVersion(
  versions: PriceBookVersion[],
  evaluationDate: string,
): { version: PriceBookVersion | null; ambiguous: boolean } {
  const candidates = versions.filter((version) =>
    isPriceBookVersionValidOnDate(version, evaluationDate),
  );

  if (candidates.length === 0) {
    return { version: null, ambiguous: false };
  }

  if (candidates.length === 1) {
    return { version: candidates[0]!, ambiguous: false };
  }

  const sorted = candidates.slice().sort((left, right) => {
    if (right.versionNumber !== left.versionNumber) {
      return right.versionNumber - left.versionNumber;
    }

    return left.id.localeCompare(right.id);
  });

  const highestVersion = sorted[0]!.versionNumber;
  const sameVersionCandidates = sorted.filter((item) => item.versionNumber === highestVersion);

  if (sameVersionCandidates.length > 1) {
    return { version: null, ambiguous: true };
  }

  return { version: sorted[0]!, ambiguous: false };
}
