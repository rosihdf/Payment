import { expect, test } from '@playwright/test';
import { gotoSidebar } from './helpers';
import { loadSupabaseEnv, requireSupabaseCredentials } from './loadSupabaseEnv';
import {
  ACCEPTANCE_TAG,
  TEST_COMPANY,
  assertNoTechnicalIds,
  assertProtectedRouteRedirectsToLogin,
  calculateRecommendation,
  createFreshContext,
  createOfferDraft,
  fillNeedStep,
  loginWithSupabaseCredentials,
  startAdviceWithCustomer,
} from './supabase-auth.helpers';

const env = loadSupabaseEnv();
let credentials: ReturnType<typeof requireSupabaseCredentials>;

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  credentials = requireSupabaseCredentials(env);
});

test.describe('Supabase Kernabnahme – authentifizierter Browserlauf', () => {
  let testLeadId: string | null = null;
  let foreignLeadId: string | null = null;
  let offerId: string | null = null;
  let fieldAdvisorLabel = '';
  let standardOriginalAmount = '';
  let employeeOriginalShare = '';

  test('Admin: Login, Session, Rollenschutz', async ({ browser }) => {
    const anonymousContext = await createFreshContext(browser);
    const anonymousPage = await anonymousContext.newPage();
    try {
      await assertProtectedRouteRedirectsToLogin(anonymousPage, '/sales');
    } finally {
      await anonymousContext.close();
    }

    const adminContext = await createFreshContext(browser);
    const adminPage = await adminContext.newPage();
    try {
      await loginWithSupabaseCredentials(
        adminPage,
        credentials.adminEmail,
        credentials.adminPassword,
      );
      await expect(adminPage.getByRole('combobox', { name: 'Demo-Benutzer wechseln' })).toHaveCount(0);

      await adminPage.reload();
      await expect(adminPage.getByRole('heading', { name: 'Arbeitsplatz' })).toBeVisible({
        timeout: 20_000,
      });

      await adminPage.goto('/admin/users');
      await expect(adminPage.getByRole('heading', { name: 'Benutzer', level: 1 })).toBeVisible();
    } finally {
      await adminContext.close();
    }
  });

  test('Admin: Kunde anlegen, bearbeiten, Betreuer, Suche', async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    try {
      await loginWithSupabaseCredentials(page, credentials.adminEmail, credentials.adminPassword);

      await gotoSidebar(page, 'Kunden');
      await expect(page.getByRole('heading', { name: 'Kunden' })).toBeVisible();

      const rows = page.getByRole('link').filter({ hasText: TEST_COMPANY });
      if ((await rows.count()) > 0) {
        await rows.first().click();
        testLeadId = page.url().match(/\/leads\/([^/?#]+)/)?.[1] ?? null;
      } else {
        await page.getByRole('link', { name: 'Neuer Kunde' }).click();
        await page.getByLabel('Firmenname').fill(TEST_COMPANY);
        await page.getByLabel('Vorname').fill('Core');
        await page.getByLabel('Nachname').fill('Repair');
        await page.getByLabel('Telefonnummer').fill('030 9998877');
        await page.getByRole('button', { name: 'Kunde speichern' }).click();
        await expect(page.getByRole('heading', { name: TEST_COMPANY })).toBeVisible();
        testLeadId = page.url().match(/\/leads\/([^/?#]+)/)?.[1] ?? null;
      }
      expect(testLeadId).toBeTruthy();

      await page.reload();
      await expect(page.getByRole('heading', { name: TEST_COMPANY })).toBeVisible();

      await gotoSidebar(page, 'Kunden');
      await page.getByRole('searchbox', { name: 'Kunden-Suche' }).fill(ACCEPTANCE_TAG);
      await expect(page.getByText(TEST_COMPANY)).toBeVisible();
      await assertNoTechnicalIds(page);

      const testCard = page.locator('li, article, div').filter({ hasText: TEST_COMPANY }).first();
      await testCard.getByRole('button', { name: 'Bearbeiten' }).click();
      await expect(page.getByRole('heading', { name: 'Kunde bearbeiten' })).toBeVisible();
      await page.getByLabel('Branche').fill('Einzelhandel Remote');
      await page.getByRole('button', { name: 'Speichern' }).click();
      await expect(page.getByText('Änderungen wurden gespeichert')).toBeVisible();

      await page.reload();
      await page.getByRole('searchbox', { name: 'Kunden-Suche' }).fill(ACCEPTANCE_TAG);
      await expect(page.getByText('Einzelhandel Remote')).toBeVisible();

      await page
        .locator('li, article, div')
        .filter({ hasText: TEST_COMPANY })
        .first()
        .getByRole('button', { name: 'Bearbeiten' })
        .click();
      const advisorSelect = page.getByLabel('Betreuer');
      await expect(advisorSelect).toBeVisible();
      const options = advisorSelect.locator('option');
      const optionCount = await options.count();
      for (let i = 0; i < optionCount; i += 1) {
        const text = (await options.nth(i).textContent())?.trim() ?? '';
        if (text && !text.includes('Bitte wählen')) {
          fieldAdvisorLabel = text;
          await advisorSelect.selectOption({ index: i });
          break;
        }
      }
      expect(fieldAdvisorLabel.length).toBeGreaterThan(0);
      await page.getByRole('button', { name: 'Speichern' }).click();
      await expect(page.getByText('Änderungen wurden gespeichert')).toBeVisible();

      await page.reload();
      await page.getByRole('searchbox', { name: 'Kunden-Suche' }).fill(ACCEPTANCE_TAG);
      await expect(page.getByText(/Betreuer:/)).toBeVisible();

      await gotoSidebar(page, 'Arbeitsplatz');
      await page.getByLabel('Suche').fill(ACCEPTANCE_TAG);
      await expect(page.getByRole('heading', { name: 'Suchtreffer' })).toBeVisible();
      await expect(page.getByText(TEST_COMPANY)).toBeVisible();

      await gotoSidebar(page, 'Kunden');
      const leadCount = await page.getByRole('link', { name: /GmbH|AG|KG|e\.K\.|Handel/i }).count();
      if (leadCount > 1) {
        for (let i = 0; i < leadCount; i += 1) {
          const link = page.getByRole('link').nth(i);
          const href = await link.getAttribute('href');
          const text = await link.innerText();
          if (href?.includes('/leads/') && !text.includes(ACCEPTANCE_TAG)) {
            foreignLeadId = href.match(/\/leads\/([^/?#]+)/)?.[1] ?? null;
            break;
          }
        }
      }
    } finally {
      await context.close();
    }
  });

  test('Admin: Beratung manuell 12,50 € mit Reload', async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    try {
      await loginWithSupabaseCredentials(page, credentials.adminEmail, credentials.adminPassword);
      await startAdviceWithCustomer(page, TEST_COMPANY);

      await expect(page.getByRole('heading', { name: 'Ausgangslage' })).toBeVisible();
      await page.getByRole('button', { name: 'Kosten manuell eingeben' }).click();
      const costsInput = page.getByLabel('Monatliche Ist-Gesamtkosten (EUR)');
      await costsInput.fill('12,50');
      await costsInput.blur();
      await expect(costsInput).toHaveValue(/12,50\s*€/);
      await page.getByRole('button', { name: 'Weiter' }).click();

      await fillNeedStep(page);

      await page
        .getByRole('navigation', { name: 'Beratungsschritte' })
        .getByRole('button', { name: /Ausgangslage/ })
        .click();
      await expect(page.getByLabel('Monatliche Ist-Gesamtkosten (EUR)')).toHaveValue(/12,50\s*€/);

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Ausgangslage' })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByLabel('Monatliche Ist-Gesamtkosten (EUR)')).toHaveValue(/12,50\s*€/);

      await page.getByRole('button', { name: /Empfehlung/ }).click();
      await calculateRecommendation(page);
      offerId = await createOfferDraft(page);
      expect(offerId).toBeTruthy();
    } finally {
      await context.close();
    }
  });

  test('Admin: Beratung 0 € mit Reload', async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    try {
      await loginWithSupabaseCredentials(page, credentials.adminEmail, credentials.adminPassword);
      await gotoSidebar(page, 'Beratung');
      await page.getByRole('link', { name: 'Beratung starten' }).click();
      await page.getByRole('button', { name: 'Ohne Kunden rechnen' }).click();
      await page.getByRole('button', { name: 'Weiter' }).click();

      await page.getByRole('button', { name: 'Noch keine Payment-Lösung / aktuelle Kosten 0 €' }).click();
      await expect(page.getByText(/Ist-Kosten:\s*0,00\s*€/)).toBeVisible();
      await page.getByRole('button', { name: 'Weiter' }).click();
      await fillNeedStep(page);

      await page
        .getByRole('navigation', { name: 'Beratungsschritte' })
        .getByRole('button', { name: /Ausgangslage/ })
        .click();
      await expect(page.getByText(/Ist-Kosten:\s*0,00\s*€/)).toBeVisible();

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Ausgangslage' })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(/Ist-Kosten:\s*0,00\s*€/)).toBeVisible();
      await expect(page.getByText(/NaN|Infinity/i)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('Admin: Standardprovision und Mitarbeitervereinbarung mit Reload', async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    try {
      await loginWithSupabaseCredentials(page, credentials.adminEmail, credentials.adminPassword);
      await page.goto('/admin/commission/standards');
      await expect(
        page.getByRole('heading', { name: 'Provision – Standard & Vereinbarungen', level: 1 }),
      ).toBeVisible();

      const standardRow = page.getByRole('row', { name: /Nur Acquiring/ }).first();
      await standardRow.getByRole('button', { name: 'Bearbeiten' }).click();
      const standardDialog = page.getByRole('dialog', { name: 'Standardregel bearbeiten' });
      await expect(standardDialog).toBeVisible();
      const amountInput = standardDialog.getByLabel('Standardbetrag (EUR)');
      standardOriginalAmount = await amountInput.inputValue();
      await amountInput.fill('175');
      await standardDialog.getByRole('button', { name: 'Speichern' }).click();
      await expect(page.getByText(/Standardregel.*gespeichert/)).toBeVisible();

      await page.reload();
      await standardRow.getByRole('button', { name: 'Bearbeiten' }).click();
      await expect(page.getByRole('dialog').getByLabel('Standardbetrag (EUR)')).toHaveValue('175');

      await page.getByRole('dialog').getByLabel('Standardbetrag (EUR)').fill(standardOriginalAmount);
      await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
      await expect(page.getByText(/Standardregel.*gespeichert/)).toBeVisible();

      const employeeRow = page.getByRole('row').filter({ hasText: fieldAdvisorLabel.split(' (')[0] });
      await employeeRow.getByRole('button', { name: 'Bearbeiten' }).click();
      const employeeDialog = page.getByRole('dialog');
      await expect(employeeDialog).toBeVisible();
      const shareInput = employeeDialog.getByLabel(/%$/).first();
      employeeOriginalShare = await shareInput.inputValue();
      await shareInput.fill('42');
      await employeeDialog.getByRole('button', { name: 'Speichern' }).click();
      await expect(page.getByText('Vereinbarung gespeichert')).toBeVisible();

      await page.reload();
      await employeeRow.getByRole('button', { name: 'Bearbeiten' }).click();
      await expect(page.getByRole('dialog').getByLabel(/%$/).first()).toHaveValue('42');

      await page.getByRole('dialog').getByLabel(/%$/).first().fill(employeeOriginalShare);
      await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
      await expect(page.getByText('Vereinbarung gespeichert')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('Admin: Angebot, PDF, Workflow-Status mit Reload', async ({ browser }) => {
    test.skip(!offerId, 'Kein Angebot aus Beratungsschritt');

    const context = await createFreshContext(browser);
    const page = await context.newPage();
    try {
      await loginWithSupabaseCredentials(page, credentials.adminEmail, credentials.adminPassword);

      await page.goto(`/offers/${offerId}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText(TEST_COMPANY)).toBeVisible();
      await assertNoTechnicalIds(page);

      await page.getByRole('button', { name: 'Angebot abschließen' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Angebot abschließen' }).click();
      await expect(page.getByText(/Abgeschlossen|abgeschlossen/)).toBeVisible({ timeout: 20_000 });

      const pdfButton = page.getByRole('button', { name: /Finales PDF erzeugen|PDF erzeugen/i });
      if (await pdfButton.count()) {
        await pdfButton.first().click();
        const confirm = page.getByRole('button', { name: /Finales PDF erzeugen|PDF erzeugen/i });
        if (await confirm.count()) {
          await confirm.last().click();
        }
        await expect(page.getByText(/PDF wurde erzeugt|PDF wurde heruntergeladen/i)).toBeVisible({
          timeout: 30_000,
        });
      }

      await page.getByRole('tab', { name: /Workflow|Freigabe/i }).click({ timeout: 5_000 }).catch(() => {});
      const approvalButton = page.getByRole('button', { name: 'Freigabe anfordern' });
      if (await approvalButton.isVisible()) {
        await approvalButton.click();
        await page.getByRole('button', { name: 'Freigabe anfordern' }).last().click();
        await expect(page.getByText(/Freigabe|Wartet/i)).toBeVisible();
      }

      await page.reload();
      await expect(page.getByText(TEST_COMPANY)).toBeVisible();
      if (await approvalButton.isVisible().catch(() => false)) {
        await expect(page.getByText(/Freigabe|Wartet|Freigabe anfordern/i)).toBeVisible();
      } else {
        await expect(page.getByText(/Freigabe|Genehmigung|Versand/i)).toBeVisible();
      }
    } finally {
      await context.close();
    }
  });

  test('Außendienst: Login, RLS, Sichtbarkeit, Schreibschutz', async ({ browser }) => {
    test.skip(!testLeadId, 'Kein Testkunde');

    const context = await createFreshContext(browser);
    const page = await context.newPage();
    try {
      await loginWithSupabaseCredentials(page, credentials.fieldEmail, credentials.fieldPassword);
      await expect(page.getByRole('combobox', { name: 'Demo-Benutzer wechseln' })).toHaveCount(0);

      await gotoSidebar(page, 'Kunden');
      await page.getByRole('searchbox', { name: 'Kunden-Suche' }).fill(ACCEPTANCE_TAG);
      await expect(page.getByText(TEST_COMPANY)).toBeVisible();

      if (foreignLeadId) {
        await page.goto(`/leads/${foreignLeadId}`);
        await expect(page.getByRole('heading', { name: 'Zugriff verweigert' })).toBeVisible();
      }

      await page.goto(`/leads/${testLeadId}`);
      await expect(page.getByRole('heading', { name: TEST_COMPANY })).toBeVisible();
      await expect(page.getByLabel('Betreuer')).toHaveCount(0);

      await gotoSidebar(page, 'Arbeitsplatz');
      await page.getByLabel('Suche').fill(ACCEPTANCE_TAG);
      await expect(page.getByText(TEST_COMPANY)).toBeVisible();

      await page.goto('/admin/commission/standards');
      await expect(page.getByRole('heading', { name: 'Zugriff verweigert' })).toBeVisible();

      await page.goto('/sales/commission');
      await expect(page.getByRole('heading', { name: 'Meine Provision' })).toBeVisible();
      await expect(page.getByText('Nur eigene Daten – keine Bearbeitung')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Speichern' })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
