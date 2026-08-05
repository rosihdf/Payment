import { expect, test } from '@playwright/test';
import { chooseCustomOption, gotoSidebar, startNewAdvice } from './helpers';
import { loadSupabaseEnv, requireSupabaseCredentials } from './loadSupabaseEnv';
import {
  ACCEPTANCE_TAG,
  TEST_COMPANY,
  assertNoTechnicalIds,
  assertProtectedRouteRedirectsToLogin,
  assertSecureForeignLeadAccess,
  calculateRecommendation,
  createFreshContext,
  createOfferDraft,
  fillNeedStep,
  loginWithSupabaseCredentials,
  saveCommissionAssignmentDialog,
  waitForCommissionAssignmentDialogReady,
  startAdviceWithCustomer,
  waitForWorkspaceReady,
  waitForLeadsReady,
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
  let foreignLeadCompany = '';
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
      await waitForWorkspaceReady(adminPage);

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
      await waitForLeadsReady(page);

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
      await waitForLeadsReady(page);
      await page.getByRole('searchbox', { name: 'Kunden-Suche' }).fill(ACCEPTANCE_TAG);
      await expect(page.getByRole('link', { name: TEST_COMPANY }).first()).toBeVisible();
      await assertNoTechnicalIds(page);

      const testCard = page.getByRole('article').filter({ hasText: TEST_COMPANY }).first();
      await testCard.getByRole('button', { name: 'Bearbeiten' }).click();
      await expect(page.getByRole('heading', { name: 'Kunde bearbeiten' })).toBeVisible();
      await page.getByLabel('Branche').fill('Einzelhandel Remote');
      await page.getByRole('dialog').getByRole('button', { name: 'Speichern', exact: true }).click();
      await expect(page.getByText('Änderungen wurden gespeichert')).toBeVisible();

      await page.reload();
      await page.getByRole('searchbox', { name: 'Kunden-Suche' }).fill(ACCEPTANCE_TAG);
      await expect(page.getByText('Einzelhandel Remote')).toBeVisible();

      await page
        .getByRole('article')
        .filter({ hasText: TEST_COMPANY })
        .first()
        .getByRole('button', { name: 'Bearbeiten' })
        .click();
      const advisorCombobox = page.getByRole('dialog').getByRole('combobox', { name: 'Betreuer' });
      await expect(advisorCombobox).toBeVisible();
      await chooseCustomOption(page, advisorCombobox, /^test \(/);
      fieldAdvisorLabel = (await advisorCombobox.textContent())?.trim() ?? '';
      expect(fieldAdvisorLabel.length).toBeGreaterThan(0);
      await page.getByRole('dialog').getByRole('button', { name: 'Speichern', exact: true }).click();
      await expect(page.getByText('Änderungen wurden gespeichert')).toBeVisible();

      await page.reload();
      await waitForLeadsReady(page);
      await page.getByRole('searchbox', { name: 'Kunden-Suche' }).fill(ACCEPTANCE_TAG);
      await expect(
        page.getByRole('article').filter({ hasText: TEST_COMPANY }).first(),
      ).toContainText(/Betreuer: test/i);

      await gotoSidebar(page, 'Arbeitsplatz');
      await waitForWorkspaceReady(page);
      await page.getByLabel('Suche').fill(ACCEPTANCE_TAG);
      await expect(page.getByRole('heading', { name: 'Arbeitsplatz wird geladen' })).toHaveCount(0, {
        timeout: 20_000,
      });
      await expect(page.getByRole('link', { name: TEST_COMPANY }).first()).toBeVisible({
        timeout: 20_000,
      });

      await gotoSidebar(page, 'Kunden');
      await waitForLeadsReady(page);
      const foreignLeadLinks = page
        .getByRole('link', { name: /GmbH|AG|KG|e\.K\.|Handel/i })
        .filter({ hasNotText: ACCEPTANCE_TAG });
      const foreignLeadCount = await foreignLeadLinks.count();
      if (foreignLeadCount > 0) {
        for (let i = 0; i < foreignLeadCount; i += 1) {
          const link = foreignLeadLinks.nth(i);
          const href = await link.getAttribute('href');
          const text = await link.innerText();
          const leadId = href?.match(/\/leads\/([^/?#]+)/)?.[1] ?? null;
          if (!leadId || leadId === 'new' || text.includes(ACCEPTANCE_TAG)) {
            continue;
          }
          foreignLeadId = leadId;
          foreignLeadCompany = text.trim().split('\n')[0]?.trim() ?? text.trim();
          break;
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
      await page
        .getByRole('navigation', { name: 'Beratungsschritte' })
        .getByRole('button', { name: /Ausgangslage/ })
        .click();
      await expect(page.getByRole('heading', { name: 'Ausgangslage' })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByLabel('Monatliche Ist-Gesamtkosten (EUR)')).toHaveValue(/12,50\s*€/);

      await page.getByRole('button', { name: 'Weiter' }).click();
      await expect(page.getByRole('heading', { name: 'Bedarf' })).toBeVisible();
      await page.getByRole('button', { name: 'Weiter' }).click();
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
      await startNewAdvice(page);
      await page.getByRole('button', { name: 'Ohne Kunden rechnen' }).click();
      await page.getByRole('button', { name: 'Weiter' }).click();

      await page.getByRole('button', { name: 'Noch keine Payment-Lösung / aktuelle Kosten 0 €' }).click();
      await expect(page.getByText('Automatisch gespeichert')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Ist-Kosten:\s*0,00\s*€/)).toBeVisible();
      await page.getByRole('button', { name: 'Weiter' }).click();
      await fillNeedStep(page);

      await page
        .getByRole('navigation', { name: 'Beratungsschritte' })
        .getByRole('button', { name: /Ausgangslage/ })
        .click();
      await expect(page.getByText(/Ist-Kosten:\s*0,00\s*€/)).toBeVisible();

      await page.reload();
      await page
        .getByRole('navigation', { name: 'Beratungsschritte' })
        .getByRole('button', { name: /Ausgangslage/ })
        .click();
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
      await page.goto('/login');
      await page.getByLabel('E-Mail').fill(credentials.adminEmail);
      await page.getByLabel('Passwort').fill(credentials.adminPassword);
      await page.getByRole('button', { name: 'Anmelden' }).click();
      await page.waitForURL(/\/sales$/, { timeout: 20_000, waitUntil: 'commit' });
      await page.goto('/admin/commission/standards', { waitUntil: 'domcontentloaded' });
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
      await expect(amountInput).toHaveValue('175');
      await standardDialog.getByRole('button', { name: 'Speichern' }).click();
      await expect(page.getByText(/Standardregel.*gespeichert/)).toBeVisible();

      await page.reload();
      await expect(
        page.getByRole('heading', { name: 'Provision – Standard & Vereinbarungen', level: 1 }),
      ).toBeVisible();
      const reloadedStandardRow = page.getByRole('row', { name: /Nur Acquiring/ }).first();
      await reloadedStandardRow.getByRole('button', { name: 'Bearbeiten' }).click();
      await expect(page.getByRole('dialog').getByLabel('Standardbetrag (EUR)')).toHaveValue('175');

      await page.getByRole('dialog').getByLabel('Standardbetrag (EUR)').fill(standardOriginalAmount);
      await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
      await expect(page.getByText(/Standardregel.*gespeichert/)).toBeVisible();
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

      const employeeSection = page.locator('section').filter({
        has: page.getByRole('heading', { name: 'Außendienst', exact: true }),
      });
      const employeeLabel = fieldAdvisorLabel.split(' (')[0]?.trim() || 'test';
      let employeeRow = employeeSection.getByRole('row').filter({ hasText: employeeLabel }).first();
      if ((await employeeRow.count()) === 0) {
        employeeRow = employeeSection.getByRole('row').filter({ hasText: credentials.fieldEmail }).first();
      }
      await expect(employeeRow).toBeVisible({ timeout: 20_000 });
      await employeeRow.getByRole('button', { name: 'Bearbeiten' }).click();
      const employeeDialog = page.getByRole('dialog', { name: /Vereinbarung –/ });
      await expect(employeeDialog).toBeVisible();
      await waitForCommissionAssignmentDialogReady(employeeDialog);
      const shareInput = employeeDialog.getByLabel('Nur Acquiring %');
      await expect(shareInput).toBeVisible({ timeout: 20_000 });
      await expect(shareInput).toHaveValue(/\d+/, { timeout: 20_000 });
      employeeOriginalShare = await shareInput.inputValue();
      await shareInput.fill('42');
      await expect(shareInput).toHaveValue('42');
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
      await saveCommissionAssignmentDialog(page, employeeDialog);

      await page.reload();
      await expect(
        page.getByRole('heading', { name: 'Provision – Standard & Vereinbarungen', level: 1 }),
      ).toBeVisible();
      const reloadedEmployeeRow = employeeSection.getByRole('row').filter({ hasText: employeeLabel }).first();
      await reloadedEmployeeRow.getByRole('button', { name: 'Bearbeiten' }).click();
      const reloadedDialog = page.getByRole('dialog', { name: /Vereinbarung –/ });
      await expect(reloadedDialog).toBeVisible();
      await waitForCommissionAssignmentDialogReady(reloadedDialog);
      const reloadedShareInput = reloadedDialog.getByLabel('Nur Acquiring %');
      await expect(reloadedShareInput).toBeVisible({ timeout: 20_000 });
      await expect(reloadedShareInput).toHaveValue('42');

      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
      await reloadedShareInput.fill(employeeOriginalShare);
      await saveCommissionAssignmentDialog(page, reloadedDialog);
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
      await expect(page.getByRole('link', { name: 'Zur Kundenakte' })).toBeVisible();
      await assertNoTechnicalIds(page);

      await page.getByRole('button', { name: 'Abschließen' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Angebot abschließen' }).click();
      await expect(page.getByText('Abgeschlossen', { exact: true }).first()).toBeVisible({
        timeout: 20_000,
      });

      await page.getByRole('tab', { name: 'Versionen & Dokumente' }).click();
      const pdfButton = page.getByRole('button', { name: 'Finales PDF erzeugen' });
      if (await pdfButton.count()) {
        await pdfButton.first().click();
        const confirm = page.getByRole('button', { name: 'Finales PDF erzeugen' });
        if (await confirm.count()) {
          await confirm.last().click();
        }
        await expect(page.getByText(/PDF wurde erzeugt|PDF wurde heruntergeladen/i)).toBeVisible({
          timeout: 30_000,
        });
      }

      await page.getByRole('tab', { name: 'Freigabe & Versand' }).click();
      const approvalButton = page.getByRole('button', { name: 'Freigabe anfordern' });
      if (await approvalButton.isVisible()) {
        await approvalButton.click();
        await page.getByRole('button', { name: 'Freigabe anfordern' }).last().click();
        await expect(page.getByText(/Freigabe|Wartet/i)).toBeVisible();
      }

      await page.reload();
      await expect(page.getByRole('link', { name: 'Zur Kundenakte' })).toBeVisible();
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
    test.skip(!foreignLeadId, 'Kein fremder Kunde in Admin-Vorlauf gefunden');

    const context = await createFreshContext(browser);
    const page = await context.newPage();
    try {
      await loginWithSupabaseCredentials(page, credentials.fieldEmail, credentials.fieldPassword);
      await expect(page.getByRole('combobox', { name: 'Demo-Benutzer wechseln' })).toHaveCount(0);

      await gotoSidebar(page, 'Kunden');
      await waitForLeadsReady(page);
      await page.getByRole('searchbox', { name: 'Kunden-Suche' }).fill(ACCEPTANCE_TAG);
      await expect(page.getByRole('link', { name: TEST_COMPANY }).first()).toBeVisible();

      await assertSecureForeignLeadAccess(page, foreignLeadId!, foreignLeadCompany);

      await page.goto(`/leads/${testLeadId}`);
      await expect(page.getByRole('heading', { name: TEST_COMPANY })).toBeVisible();
      await expect(page.getByLabel('Betreuer')).toHaveCount(0);

      await gotoSidebar(page, 'Arbeitsplatz');
      await page.getByLabel('Suche').fill(ACCEPTANCE_TAG);
      await expect(page.getByRole('link', { name: TEST_COMPANY }).first()).toBeVisible();

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
