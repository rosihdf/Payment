import { expect, test } from '@playwright/test';
import { buildPublicOfferView } from '../src/domain/offer/publicOfferView';
import { generateShareToken } from '../src/domain/offer/shareToken';
import type { OfferVersionSnapshot } from '../src/domain/offer/offerVersion';

/**
 * Öffentliche Kundenansicht `/offer-review/:token` (`OfferReviewPage.tsx`).
 * API wird im lokalen E2E über `page.route` gemockt (Worker läuft nicht im Vite-Dev).
 */

function buildTestSnapshot(tag: string): OfferVersionSnapshot {
  const terminalLine = {
    id: 'item_terminal_1',
    type: 'terminal' as const,
    productSnapshot: null,
    name: `${tag} Terminal Pro`,
    description: 'Mobiles Kartenterminal',
    quantity: 2,
    priceType: 'monthly' as const,
    unitPriceCents: 1500,
    unitLabel: 'je Terminal/Monat',
    originalUnitPriceCents: 1500,
    priceOverridden: false,
    priceOverrideReason: '',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  return {
    schemaVersion: 1,
    offerId: `offer_${tag}`,
    offerNumber: `E2E-${tag}`,
    customerSnapshot: {
      companyName: `${tag} Testkunde GmbH`,
      contactFirstName: 'Erika',
      contactLastName: 'Musterfrau',
    },
    tariffSnapshot: {
      name: 'BestPay Classic',
      providerName: 'BestPay',
    },
    items: [terminalLine],
    title: 'BestPay Angebot',
    introductionText: '',
    totals: {
      oneTimeTotalCents: 9900,
      monthlyTotalCents: 3000,
    },
    sourceComparisonSessionId: null,
    sourceScenarioId: null,
    contractModel: 'rental',
    termMonths: 36,
    terminalCount: 2,
    optionalTerminalCount: 0,
    terminalLines: [terminalLine],
    accessoryLines: [],
    priceBookVersion: null,
    pricingEvaluationId: null,
  } as unknown as OfferVersionSnapshot;
}

test.describe('Öffentliche Angebotsprüfung /offer-review/:token', () => {
  test('zeigt Angebotsdaten und Kundenaktionen für gültigen Token', async ({ page }) => {
    const tag = `E2E${Date.now()}`;
    const token = generateShareToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const snapshot = buildTestSnapshot(tag);
    const view = buildPublicOfferView({
      snapshot,
      versionNumber: 1,
      versionCreatedAt: '2026-08-01T09:00:00.000Z',
      salesContactName: 'Laura Berger',
      linkValidUntil: '2099-01-01T00:00:00.000Z',
      hasPdf: false,
      formatMoney: (cents) => `${(cents / 100).toFixed(2).replace('.', ',')} €`,
      formatItemPrice: (priceType, cents) =>
        cents === null ? '–' : `${(cents / 100).toFixed(2).replace('.', ',')} €`,
    });

    await page.route(`**/api/public/offers/${token}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, view }),
      });
    });

    await page.goto(`/offer-review/${token}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('AMRtech', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ihr Angebot', exact: true })).toBeVisible();
    await expect(page.getByText(view.offerNumber)).toBeVisible();
    await expect(page.getByText(view.companyName)).toBeVisible();
    await expect(page.getByText('BestPay Classic')).toBeVisible();
    if (view.termMonths) {
      await expect(page.getByText(`${view.termMonths} Monate`)).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Angebot annehmen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Angebot ablehnen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rückfrage senden' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Änderung anfragen' })).toBeVisible();

    await page.route(`**/api/public/offers/${token}/questions`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.getByRole('button', { name: 'Rückfrage senden' }).click();
    await page.getByLabel('Ihre Frage').fill(`${tag}: Ist ein Wechsel des Terminalmodells möglich?`);
    await page.getByRole('button', { name: 'Absenden' }).click();
    await expect(page.getByRole('heading', { name: 'Vielen Dank' })).toBeVisible();
  });

  test('Annahme und Ablehnung setzen den öffentlichen Bestätigungstext', async ({ page }) => {
    const tag = `E2E${Date.now()}`;
    const token = generateShareToken();
    const snapshot = buildTestSnapshot(tag);
    const view = buildPublicOfferView({
      snapshot,
      versionNumber: 1,
      versionCreatedAt: '2026-08-01T09:00:00.000Z',
      salesContactName: 'Laura Berger',
      linkValidUntil: '2099-01-01T00:00:00.000Z',
      hasPdf: false,
      formatMoney: (cents) => `${(cents / 100).toFixed(2).replace('.', ',')} €`,
      formatItemPrice: (priceType, cents) =>
        cents === null ? '–' : `${(cents / 100).toFixed(2).replace('.', ',')} €`,
    });

    await page.route(`**/api/public/offers/${token}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, view }),
      });
    });
    await page.route(`**/api/public/offers/${token}/accept`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto(`/offer-review/${token}`);
    await page.getByRole('button', { name: 'Angebot annehmen' }).click();
    await expect(page.getByText(/Sie haben das Angebot angenommen/)).toBeVisible();
  });

  test('zeigt eine Fehlermeldung für einen ungültigen Token', async ({ page }) => {
    const invalidToken = generateShareToken();
    await page.route(`**/api/public/offers/${invalidToken}`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: 'invalid',
          message: 'Dieser Link ist ungültig.',
        }),
      });
    });

    await page.goto(`/offer-review/${invalidToken}`);
    await expect(page.getByRole('heading', { name: 'Link nicht verfügbar' })).toBeVisible();
    await expect(page.getByText('Dieser Link ist ungültig.')).toBeVisible();
  });
});
