import { expect, test } from '@playwright/test';
import { startNewAdvice } from './helpers';

/**
 * OCR-Beratungspfad (UI).
 *
 * Start z. B.:
 *   CI=1 VITE_BILLING_OCR_IMPORT_ENABLED=true VITE_BILLING_DEMO_OCR=true \
 *     npx playwright test e2e/ocr-billing-import.spec.ts
 *
 * Demo-OCR ist Fixture-/Mock-basiert. Parser-/Sync-Wahrheit: Vitest-Fixtures.
 */
/** Produktstandard: OCR aktiv, außer explizit VITE_BILLING_OCR_IMPORT_ENABLED=false. */
const ocrUiEnabled = process.env.VITE_BILLING_OCR_IMPORT_ENABLED !== 'false';

async function startAdviceAtCosts(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sales$/);
  await startNewAdvice(page);
  await page.getByRole('button', { name: 'Ohne Kundenzuordnung beraten' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByRole('heading', { name: 'Ausgangslage' })).toBeVisible();
}

test.describe('OCR Abrechnung einlesen (Feature-Flag)', () => {
  test.skip(!ocrUiEnabled, 'OCR-Flag ist deaktiviert (VITE_BILLING_OCR_IMPORT_ENABLED=false)');

  test('prüft, übernimmt und behält Werte nach Reload', async ({ page }) => {
    await startAdviceAtCosts(page);
    await page.getByRole('button', { name: 'Abrechnung einlesen' }).click();
    await expect(page.getByText(/Abrechnung prüfen|vorbereitet|lokal/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Periode manuell' }).click();
    await page.getByLabel('Zeitraum von').fill('2026-01-01');
    await page.getByLabel('Zeitraum bis').fill('2026-01-31');
    await page.getByLabel('Kartenumsatz').fill('12345,67');
    await page.getByLabel('Transaktionen').fill('420');
    await page.getByLabel('Gesamtbetrag').fill('89,50');
    await page.getByRole('button', { name: 'Periode speichern' }).click();

    await page.getByRole('button', { name: 'Werte übernehmen' }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByRole('heading', { name: 'Bedarf' })).toBeVisible();
    await expect(page.getByLabel('Monatlicher Kartenumsatz (EUR)')).toHaveValue(/12\.345/);

    await page.getByRole('button', { name: 'Zurück' }).click();
    await expect(page.getByRole('heading', { name: 'Ausgangslage' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ausgangslage' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Abrechnung einlesen' })).toBeVisible();
  });

  test('Wechsel zur manuellen Eingabe überschreibt vorhandene Werte nicht', async ({ page }) => {
    await startAdviceAtCosts(page);
    await page.getByRole('button', { name: 'Kosten manuell eingeben' }).click();
    const costsInput = page.getByLabel('Monatliche Ist-Gesamtkosten (EUR)');
    await costsInput.fill('55');
    await costsInput.blur();
    await expect(costsInput).toHaveValue(/55,00\s*€/);

    await page.getByRole('button', { name: 'Abrechnung einlesen' }).click();
    await expect(page.getByText(/Abrechnung prüfen|vorbereitet|lokal/i)).toBeVisible({
      timeout: 15_000,
    });
    // Ohne „Werte übernehmen“ zurück zur manuellen Erfassung – bestehende Werte bleiben.
    await page.getByRole('button', { name: 'Kosten manuell eingeben' }).click();
    await expect(page.getByLabel('Monatliche Ist-Gesamtkosten (EUR)')).toHaveValue(/55,00\s*€/);
  });
});

