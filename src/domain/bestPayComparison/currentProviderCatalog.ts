/**
 * Bekannte Zahlungsanbieter aus OCR-Erkennung und produktiver Nutzung.
 * Keine Fantasieanbieter – nur belegte Namen.
 */
export const KNOWN_CURRENT_PROVIDERS = [
  'SumUp',
  'PayPal Zettle',
  'Adyen',
  'Worldline',
  'Ingenico',
  'TeleCash',
  'VR Payment',
  'Hobex',
  'CardProcess',
  'Payone',
  'Concardis',
  'Nexi',
  'Stripe',
  'Clover',
  'myPOS',
  'Tim',
  'BestPay',
] as const;

export type KnownCurrentProvider = (typeof KNOWN_CURRENT_PROVIDERS)[number];

export const CURRENT_PROVIDER_NONE = 'none';
export const CURRENT_PROVIDER_OTHER = 'other';

export type CurrentProviderCode =
  | ''
  | typeof CURRENT_PROVIDER_NONE
  | typeof CURRENT_PROVIDER_OTHER
  | KnownCurrentProvider;

export function isKnownCurrentProvider(value: string): value is KnownCurrentProvider {
  return (KNOWN_CURRENT_PROVIDERS as readonly string[]).includes(value);
}

/** Mappt Freitext/OCR-Namen auf Katalogcode + optionales Zusatzfeld. */
export function mapProviderNameToSelection(rawName: string | null | undefined): {
  code: CurrentProviderCode;
  other: string;
} {
  const name = rawName?.trim() ?? '';
  if (!name) {
    return { code: '', other: '' };
  }
  const exact = KNOWN_CURRENT_PROVIDERS.find(
    (entry) => entry.toLowerCase() === name.toLowerCase(),
  );
  if (exact) {
    return { code: exact, other: '' };
  }
  const partial = KNOWN_CURRENT_PROVIDERS.find(
    (entry) =>
      name.toLowerCase().includes(entry.toLowerCase()) ||
      entry.toLowerCase().includes(name.toLowerCase()),
  );
  if (partial) {
    return { code: partial, other: '' };
  }
  return { code: CURRENT_PROVIDER_OTHER, other: name };
}

/** Persistierter Anzeigename für Lead.currentProvider / Berichte. */
export function resolveCurrentProviderDisplayName(
  code: CurrentProviderCode | string | undefined,
  other: string | undefined,
): string {
  if (!code || code === '') {
    return '';
  }
  if (code === CURRENT_PROVIDER_NONE) {
    return 'Noch kein Anbieter';
  }
  if (code === CURRENT_PROVIDER_OTHER) {
    return other?.trim() || 'Anderer Anbieter';
  }
  return code;
}
