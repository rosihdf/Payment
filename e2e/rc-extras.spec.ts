import { expect, test } from '@playwright/test';
import { buildPublicOfferView } from '../src/domain/offer/publicOfferView';
import { generateShareToken } from '../src/domain/offer/shareToken';
import type { OfferVersionSnapshot } from '../src/domain/offer/offerVersion';
import {
  chooseCustomOption,
  e2eTag,
  ensureRecommendation,
  gotoSidebar,
  startNewAdvice,
  seedPricingCatalogForE2E,
  switchDemoUser,
} from './helpers';

/**
 * RC1-Zusatzpfade: Reload/Zurück in Beratung, Produktbearbeitung,
 * Mitarbeitervereinbarung, öffentlicher Änderungswunsch, BestPay-Dokumentation.
 */

test.describe('RC1 Extra: Beratung Reload und Navigation', () => {
  test('0 € Kosten, zurück/vor und Reload behalten Eingaben', async ({ page }) => {
    await seedPricingCatalogForE2E(page);
    await page.goto('/');
    await startNewAdvice(page);
    await page.getByRole('button', { name: 'Ohne Kunden rechnen' }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByRole('heading', { name: 'Ausgangslage' })).toBeVisible();
    await page.getByRole('button', { name: 'Kosten manuell eingeben' }).click();
    await page.getByLabel('Monatliche Ist-Gesamtkosten (EUR)').fill('0');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByRole('heading', { name: 'Bedarf' })).toBeVisible();
    await chooseCustomOption(page, page.getByRole('combobox', { name: 'Branche' }), 'Gastronomie');
    await page.getByLabel('Monatlicher Kartenumsatz (EUR)').fill('2500');

    await page
      .getByRole('navigation', { name: 'Beratungsschritte' })
      .getByRole('button', { name: /Ausgangslage/ })
      .click();
    await expect(page.getByRole('heading', { name: 'Ausgangslage' })).toBeVisible();
    await expect(page.getByLabel('Monatliche Ist-Gesamtkosten (EUR)')).toHaveValue(/0,00\s*€/);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByRole('heading', { name: 'Bedarf' })).toBeVisible();
    await expect(page.getByLabel('Monatlicher Kartenumsatz (EUR)')).toHaveValue(/2\.500,00\s*€/);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Bedarf' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Monatlicher Kartenumsatz (EUR)')).toHaveValue(/2\.500,00\s*€/);
  });
});

test.describe('RC1 Extra: Admin Produkt und Mitarbeitervereinbarung', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sales');
    await switchDemoUser(page, /Michael Weber/);
  });

  test('bearbeitet ein Produkt und speichert Änderungen', async ({ page }) => {
    const tag = e2eTag();
    await page.goto('/admin/catalog?tab=products');
    await expect(page.getByRole('heading', { name: 'Produkte & Konditionen' })).toBeVisible();
    await page.getByRole('link', { name: 'Bearbeiten' }).first().click();
    await expect(page.getByRole('heading', { name: 'Produkt bearbeiten' })).toBeVisible();
    await page.getByLabel('Interne Hinweise').fill(`${tag} Produktnotiz`);
    await page.getByRole('button', { name: 'Änderungen speichern' }).click();
    await expect(page.getByText('Produkt wurde gespeichert')).toBeVisible();
  });

  test('ändert Mitarbeitervereinbarung und zeigt Wert nach Reload', async ({ page }) => {
    await page.goto('/admin/commission/standards');
    await expect(
      page.getByRole('heading', { name: 'Provision – Standard & Vereinbarungen', level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mitarbeiter & Vereinbarungen' })).toBeVisible();

    // Außendienst-Zeile „Laura Berger“ öffnen (nicht Standardregel-„Bearbeiten“).
    const employeeRow = page.getByRole('row').filter({ hasText: 'Laura Berger' });
    await employeeRow.getByRole('button', { name: 'Bearbeiten' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Laura Berger');

    const shareInput = dialog.getByLabel(/%$/).first();
    await shareInput.fill('42');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Vereinbarung gespeichert')).toBeVisible();
    await expect(dialog).toBeHidden();

    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Provision – Standard & Vereinbarungen', level: 1 }),
    ).toBeVisible();
    await page.getByRole('row').filter({ hasText: 'Laura Berger' }).getByRole('button', { name: 'Bearbeiten' }).click();
    await expect(page.getByRole('dialog').getByLabel(/%$/).first()).toHaveValue('42');
  });
});

test.describe('RC1 Extra: Öffentlicher Änderungswunsch', () => {
  test('sendet Änderungswunsch über öffentlichen Kundenlink', async ({ page }) => {
    const tag = `E2E${Date.now()}`;
    const token = generateShareToken();
    const snapshot = {
      schemaVersion: 1,
      offerId: `offer_${tag}`,
      offerNumber: `E2E-${tag}`,
      customerSnapshot: {
        companyName: `${tag} Testkunde GmbH`,
        contactFirstName: 'Erika',
        contactLastName: 'Musterfrau',
      },
      tariffSnapshot: { name: 'BestPay Classic', providerName: 'BestPay' },
      items: [],
      title: 'BestPay Angebot',
      introductionText: '',
      totals: { oneTimeTotalCents: 0, monthlyTotalCents: 2900 },
      sourceComparisonSessionId: null,
      sourceScenarioId: null,
      contractModel: 'rental',
      termMonths: 36,
      terminalCount: 1,
      optionalTerminalCount: 0,
      terminalLines: [],
      accessoryLines: [],
      priceBookVersion: null,
      pricingEvaluationId: null,
    } as unknown as OfferVersionSnapshot;

    const view = buildPublicOfferView({
      snapshot,
      versionNumber: 1,
      versionCreatedAt: '2026-08-01T09:00:00.000Z',
      salesContactName: 'Laura Berger',
      linkValidUntil: '2099-01-01T00:00:00.000Z',
      hasPdf: true,
      formatMoney: (cents) => `${(cents / 100).toFixed(2).replace('.', ',')} €`,
      formatItemPrice: (_t, cents) =>
        cents === null ? '–' : `${(cents / 100).toFixed(2).replace('.', ',')} €`,
    });

    await page.route(`**/api/public/offers/${token}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, view }),
      });
    });
    await page.route(`**/api/public/offers/${token}/change-requests`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.route(`**/api/public/offers/${token}/changes`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto(`/offer-review/${token}`);
    await expect(page.getByRole('heading', { name: 'Angebotsprüfung' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PDF anzeigen' })).toBeVisible();
    await page.getByRole('button', { name: 'Änderung wünschen' }).click();
    await page.getByLabel('Beschreibung').fill(`${tag}: bitte Laufzeit auf 24 Monate`);
    await page.getByRole('button', { name: 'Absenden' }).click();
    await expect(page.getByRole('heading', { name: 'Vielen Dank' })).toBeVisible();
  });
});

test.describe('RC1 Extra: BestPay-Handoff Dokumentation', () => {
  test('erreicht Closing-Schritt und öffnet BestPay-Versanddialog', async ({ page }) => {
    const tag = e2eTag();
    await seedPricingCatalogForE2E(page);
    await page.goto('/');
    await gotoSidebar(page, 'Kunden');
    await page.getByRole('link', { name: 'Neuer Kunde' }).click();
    const companyName = `${tag} Handoff GmbH`;
    await page.getByLabel('Firmenname').fill(companyName);
    await page.getByLabel('Vorname').fill('Hans');
    await page.getByLabel('Nachname').fill('Handoff');
    await page.getByLabel('Telefonnummer').fill('030 999888');
    await page.getByRole('button', { name: 'Kunde speichern' }).click();
    await expect(page.getByRole('heading', { name: companyName })).toBeVisible();

    await page.getByRole('link', { name: 'Beratung starten' }).click();
    await expect(page.getByRole('heading', { name: 'Kunde', level: 2 })).toBeVisible();
    // leadId aus URL übernimmt oft den Kunden – sonst suchen.
    if (await page.getByRole('button', { name: 'Kunde suchen' }).count()) {
      await page.getByRole('button', { name: 'Kunde suchen' }).click();
      await page.getByLabel('Suche').fill(tag);
      const match = page.getByRole('button', { name: companyName });
      if (await match.count()) {
        await match.click();
      }
    }
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Kosten manuell eingeben' }).click();
    await page.getByLabel('Monatliche Ist-Gesamtkosten (EUR)').fill('120');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await chooseCustomOption(page, page.getByRole('combobox', { name: 'Branche' }), 'Einzelhandel');
    await page.getByLabel('Monatlicher Kartenumsatz (EUR)').fill('8000');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await ensureRecommendation(page);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Angebotsentwurf erzeugen' }).click();
    await expect(page.getByText(/^Angebot .+/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByRole('heading', { name: 'Prüfung & Nachfassen' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Externer BestPay-Abschluss')).toBeVisible();
    await page.getByRole('button', { name: /Versand dokumentieren|Dokument versendet/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/BestPay|Versand|Dokument/i).first()).toBeVisible();
  });
});
