import type { OfferCommercialSnapshot } from './offerCommercialSnapshot';
import { OFFER_COMMERCIAL_SNAPSHOT_VERSION } from './offerCommercialSnapshot';

export function normalizeOfferCommercialSnapshot(value: unknown): OfferCommercialSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== OFFER_COMMERCIAL_SNAPSHOT_VERSION) {
    return null;
  }

  if (raw.status !== 'frozen' && raw.status !== 'legacy_unfrozen') {
    return null;
  }

  if (!raw.identity || !raw.commercialConfig || !raw.projection || !raw.sources) {
    return null;
  }

  return raw as unknown as OfferCommercialSnapshot;
}

export function resolveOfferCommercialLegacyStatus(
  commercialSnapshot: OfferCommercialSnapshot | null,
): 'frozen' | 'legacy_unfrozen' {
  return commercialSnapshot?.status === 'frozen' ? 'frozen' : 'legacy_unfrozen';
}
