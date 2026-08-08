/**
 * Produktbezogene Laufzeitfähigkeit laut Originalunterlagen (Blanko Angebote.pdf).
 * Kein globales [24, 36] – Laufzeiten nur dort fest vorgeben, wo dokumentiert.
 */

export const PRODUCT_EC_MOBILE_PREMIUM_ID = 'product_ec_mobile_premium';

/** Nur für historische Sessions – nicht mehr aktiv anbieten. */
export const LEGACY_CONTRACT_TERM_MONTHS = [24] as const;

export interface CommercialTermCapabilityRecord {
  /** Fest dokumentierte Laufzeiten in Monaten (Reihenfolge egal). */
  documentedTermsMonths: number[];
  /** Blanko-Feld / „andere Laufzeiten auf Anfrage“. */
  customTermAllowed: boolean;
  termSourceReference: string;
  /**
   * Laufzeiten, bei denen die Provision laut PPT weder „>36“ noch „<36“ definiert ist.
   * Vertragslaufzeit darf wählbar sein; Provision bleibt separat blockiert.
   */
  commissionAmbiguousTermMonths: number[];
}

export interface CommercialTermOptions {
  productId: string | null;
  tariffId: string | null;
  documentedTermsMonths: number[];
  customTermAllowed: boolean;
  termSourceReference: string;
  commissionAmbiguousTermMonths: number[];
  /** Für UI-Dropdown: nur dokumentierte feste Laufzeiten. */
  selectableDocumentedMonths: number[];
  /** Historische Werte (z. B. 24) – lesbar, nicht neu anbieten. */
  legacyReadableMonths: readonly number[];
}

const COMMISSION_AMBIGUOUS_36 = [36] as const;

const CAPABILITY_BY_PRODUCT: Record<string, CommercialTermCapabilityRecord> = {
  product_speedypay_t2: {
    documentedTermsMonths: [36],
    customTermAllowed: true,
    termSourceReference: 'Blanko Angebote.pdf – Mietkasse T2 ausgefüllt (36 Monate) + auf Anfrage',
    commissionAmbiguousTermMonths: [...COMMISSION_AMBIGUOUS_36],
  },
  product_speedypay_v3: {
    documentedTermsMonths: [],
    customTermAllowed: true,
    termSourceReference: 'Blanko Angebote.pdf – Mietkasse V3 Blanko + andere Laufzeiten auf Anfrage',
    commissionAmbiguousTermMonths: [...COMMISSION_AMBIGUOUS_36],
  },
  product_speedypay_a920_cash_register: {
    documentedTermsMonths: [],
    customTermAllowed: true,
    termSourceReference: 'Blanko Angebote.pdf – Mietkasse A920 Blanko + auf Anfrage',
    commissionAmbiguousTermMonths: [...COMMISSION_AMBIGUOUS_36],
  },
  product_speedypay_ccv_a920: {
    documentedTermsMonths: [],
    customTermAllowed: true,
    termSourceReference: 'Blanko Angebote.pdf – EC-Terminal A920 Blanko + Fairnessgarantie',
    commissionAmbiguousTermMonths: [...COMMISSION_AMBIGUOUS_36],
  },
  product_speedypay_ccv_a77: {
    documentedTermsMonths: [],
    customTermAllowed: true,
    termSourceReference: 'Blanko Angebote.pdf – EC-Terminal A77 Blanko',
    commissionAmbiguousTermMonths: [...COMMISSION_AMBIGUOUS_36],
  },
  product_speedypay_ccv_a960: {
    documentedTermsMonths: [],
    customTermAllowed: true,
    termSourceReference: 'Blanko Angebote.pdf – EC-Terminal A960 Blanko',
    commissionAmbiguousTermMonths: [...COMMISSION_AMBIGUOUS_36],
  },
  [PRODUCT_EC_MOBILE_PREMIUM_ID]: {
    documentedTermsMonths: [48],
    customTermAllowed: false,
    termSourceReference: 'Blanko Angebote.pdf – EC Mobile Premium ausgefüllt (48 Monate)',
    commissionAmbiguousTermMonths: [],
  },
};

const CAPABILITY_BY_TARIFF: Record<string, CommercialTermCapabilityRecord> = {
  tariff_bestpay_a920_classic: {
    documentedTermsMonths: [],
    customTermAllowed: true,
    termSourceReference: 'Blanko Angebote.pdf – EC-Terminal A920 Blanko (Flyer nennt keine feste Laufzeit)',
    commissionAmbiguousTermMonths: [...COMMISSION_AMBIGUOUS_36],
  },
  tariff_bestpay_a920_flat: {
    documentedTermsMonths: [],
    customTermAllowed: true,
    termSourceReference: 'Blanko Angebote.pdf – EC-Terminal A920 Blanko (Flyer nennt keine feste Laufzeit)',
    commissionAmbiguousTermMonths: [...COMMISSION_AMBIGUOUS_36],
  },
};

const EMPTY_CAPABILITY: CommercialTermCapabilityRecord = {
  documentedTermsMonths: [],
  customTermAllowed: false,
  termSourceReference: 'Keine Laufzeitquelle für dieses Produkt hinterlegt',
  commissionAmbiguousTermMonths: [...COMMISSION_AMBIGUOUS_36],
};

function resolveCapability(
  productId: string | null,
  tariffId: string | null,
): CommercialTermCapabilityRecord {
  if (productId && CAPABILITY_BY_PRODUCT[productId]) {
    return CAPABILITY_BY_PRODUCT[productId];
  }
  if (tariffId && CAPABILITY_BY_TARIFF[tariffId]) {
    return CAPABILITY_BY_TARIFF[tariffId];
  }
  return EMPTY_CAPABILITY;
}

export function getCommercialTermOptions(
  productId: string | null,
  options: { tariffId?: string | null } = {},
): CommercialTermOptions {
  const tariffId = options.tariffId ?? null;
  const capability = resolveCapability(productId, tariffId);
  const documentedTermsMonths = [...capability.documentedTermsMonths].sort((a, b) => a - b);

  return {
    productId,
    tariffId,
    documentedTermsMonths,
    customTermAllowed: capability.customTermAllowed,
    termSourceReference: capability.termSourceReference,
    commissionAmbiguousTermMonths: [...capability.commissionAmbiguousTermMonths],
    selectableDocumentedMonths: documentedTermsMonths,
    legacyReadableMonths: LEGACY_CONTRACT_TERM_MONTHS,
  };
}

export function isCommissionTermAmbiguous(
  termMonths: number | null,
  options: CommercialTermOptions,
): boolean {
  if (termMonths === null) {
    return false;
  }
  return options.commissionAmbiguousTermMonths.includes(termMonths);
}

/** Prüft, ob eine Laufzeit für Neuauswahl angeboten werden darf (nicht Legacy). */
export function isTermOfferedForSelection(
  months: number,
  options: CommercialTermOptions,
): boolean {
  if (options.legacyReadableMonths.includes(months as (typeof LEGACY_CONTRACT_TERM_MONTHS)[number])) {
    return false;
  }
  return options.documentedTermsMonths.includes(months);
}

/**
 * Normalisiert gespeicherte Laufzeit für Anzeige: Legacy-Werte bleiben lesbar,
 * werden aber nicht auf künstliche Katalogwerte gemappt.
 */
export function normalizeReadableTermMonths(
  value: number | null | undefined,
  options: CommercialTermOptions,
): number | null {
  if (value === null || value === undefined || value === 0) {
    return null;
  }
  if (
    options.documentedTermsMonths.includes(value) ||
    options.legacyReadableMonths.includes(value as (typeof LEGACY_CONTRACT_TERM_MONTHS)[number]) ||
    options.customTermAllowed
  ) {
    return value;
  }
  return value;
}

export interface CommercialTermSelectOption {
  months: number;
  label: string;
  documented: boolean;
  legacy: boolean;
}

/** UI-Optionen inkl. Legacy-Eintrag für bestehende Sessions. */
export function buildCommercialTermSelectOptions(
  options: CommercialTermOptions,
  currentMonths: number | null,
): CommercialTermSelectOption[] {
  const result: CommercialTermSelectOption[] = options.selectableDocumentedMonths.map(
    (months) => ({
      months,
      label: `${months} Monate`,
      documented: true,
      legacy: false,
    }),
  );

  for (const legacyMonth of options.legacyReadableMonths) {
    if (currentMonths === legacyMonth && !result.some((entry) => entry.months === legacyMonth)) {
      result.push({
        months: legacyMonth,
        label: `${legacyMonth} Monate (historisch)`,
        documented: false,
        legacy: true,
      });
    }
  }

  if (
    currentMonths !== null &&
    currentMonths > 0 &&
    !result.some((entry) => entry.months === currentMonths) &&
    options.customTermAllowed
  ) {
    result.push({
      months: currentMonths,
      label: `${currentMonths} Monate (individuell)`,
      documented: false,
      legacy: false,
    });
  }

  return result.sort((left, right) => left.months - right.months);
}
