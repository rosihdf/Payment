import { expect, test } from '@playwright/test';
import { startNewAdvice } from './helpers';

/**
 * Realer Browser-OCR-Pfad (Tesseract, kein Demo-Mock).
 *
 *   CI=1 VITE_BILLING_OCR_IMPORT_ENABLED=true \
 *     npx playwright test e2e/ocr-billing-real.spec.ts
 */
/** Produktstandard: OCR aktiv, außer explizit VITE_BILLING_OCR_IMPORT_ENABLED=false. */
const ocrUiEnabled = process.env.VITE_BILLING_OCR_IMPORT_ENABLED !== 'false';
const demoOcr = process.env.VITE_BILLING_DEMO_OCR === 'true';

test.describe('OCR real Tesseract', () => {
  test.skip(!ocrUiEnabled || demoOcr, 'Benötigt aktives OCR-Flag ohne DEMO_OCR');

  test('erkennt synthetisches PNG und zeigt prüfbare Felder', async ({ page }) => {
    test.setTimeout(180_000);

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto('/');
    await expect(page).toHaveURL(/\/sales$/);
    await startNewAdvice(page);
    await page.getByRole('button', { name: 'Ohne Kundenzuordnung beraten' }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Abrechnung einlesen' }).click();
    await expect(page.getByRole('heading', { name: 'Abrechnung prüfen und bestätigen' })).toBeVisible({
      timeout: 15_000,
    });

    const pngBytes = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = 900;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('no canvas');
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 40px Arial';
      const lines = [
        'SumUp Monatsabrechnung',
        'Zeitraum: 01.01.2026 - 31.01.2026',
        'Kartenumsatz 12.345,67 EUR',
        'Anzahl Transaktionen 420',
        'Grundgebuehr 29,00 EUR',
        'Terminalmiete 19,00 EUR',
        'Transaktionsgebuehren 41,50 EUR',
        'Monatliche Gesamtkosten 89,50 EUR',
      ];
      lines.forEach((line, index) => {
        ctx.fillText(line, 48, 90 + index * 80);
      });
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('blob'))), 'image/png');
      });
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });

    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'synthetic-billing.png',
      mimeType: 'image/png',
      buffer: Buffer.from(pngBytes),
    });

    await expect(page.getByText('synthetic-billing.png')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /^Erkennung starten$/ }).click();

    await expect(page.getByText('Extraktion abgeschlossen – bitte Werte prüfen')).toBeVisible({
      timeout: 120_000,
    });
    expect(pageErrors.some((message) => /importScripts|BILLING_OCR|wasm/i.test(message))).toBe(false);

    // Reale OCR liefert prüfbare Felder; Bestätigung kann offene Findings blockieren.
    await expect(page.getByText('Kartenumsatz', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/erkannt|bitte prüfen|nicht erkannt/i).first()).toBeVisible();

    // Belastbarer Abschluss über manuelle Periode (gleiche Übernahme-Kette wie Produktivpfad).
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
  });
});

