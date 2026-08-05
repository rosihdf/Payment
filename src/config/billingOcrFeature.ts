/**
 * Steuert die Sichtbarkeit von „Abrechnung einlesen“ in der Beratung.
 * Standard: aktiv. Explizit mit VITE_BILLING_OCR_IMPORT_ENABLED=false abschaltbar.
 */
export function isAdviceBillingOcrImportEnabled(): boolean {
  return import.meta.env.VITE_BILLING_OCR_IMPORT_ENABLED !== 'false';
}
