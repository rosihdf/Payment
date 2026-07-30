import type { OfferDocumentSnapshot } from './offerDocument';

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValue(record[key]);
    }

    return sorted;
  }

  return value;
}

export function createHashInputFromSnapshot(
  snapshot: OfferDocumentSnapshot,
): Record<string, unknown> {
  const { contentHash: _ignored, ...rest } = snapshot;
  return sortValue(rest) as Record<string, unknown>;
}

export function canonicalizeSnapshotForHash(snapshot: OfferDocumentSnapshot): string {
  return JSON.stringify(createHashInputFromSnapshot(snapshot));
}

export async function computeOfferDocumentContentHash(
  snapshot: Omit<OfferDocumentSnapshot, 'contentHash'>,
): Promise<string> {
  const canonical = JSON.stringify(sortValue(snapshot));
  const encoded = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function isValidSha256HexHash(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}
