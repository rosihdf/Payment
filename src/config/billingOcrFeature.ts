/**
 * Steuert die Sichtbarkeit von „Abrechnung einlesen“ in der Beratung.
 * Bis zur realen Produktionsabnahme bewusst opt-in (nicht standardmäßig aktiv).
 */
export function isAdviceBillingOcrImportEnabled(): boolean {
  return import.meta.env.VITE_BILLING_OCR_IMPORT_ENABLED === 'true';
}
