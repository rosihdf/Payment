import { expect, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { chooseCustomOption, ensureRecommendation, gotoSidebar, startNewAdvice } from './helpers';

export const ACCEPTANCE_TAG = 'CORE_REPAIR_BROWSER';
export const TEST_COMPANY = `${ACCEPTANCE_TAG} Test GmbH`;

const EMPTY_STORAGE_STATE = {
  cookies: [] as [],
  origins: [] as [],
};

/** Vollständig leerer Browser-Kontext – keine Cookies, kein Local-/SessionStorage, kein storageState. */
export async function createFreshContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ storageState: EMPTY_STORAGE_STATE });
}

export async function withFreshPage(
  browser: Browser,
  run: (page: Page) => Promise<void>,
): Promise<void> {
  const context = await createFreshContext(browser);
  const page = await context.newPage();
  try {
    await run(page);
  } finally {
    await context.close();
  }
}

export async function waitForLeadsReady(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Kunden', exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('heading', { name: 'Kunden werden geladen' })).toHaveCount(0, {
    timeout: 20_000,
  });
  await expect(page.getByRole('searchbox', { name: 'Kunden-Suche' })).toBeVisible({
    timeout: 20_000,
  });
}

export async function waitForWorkspaceReady(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Arbeitsplatz', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('heading', { name: 'Arbeitsplatz wird geladen' })).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.getByLabel('Suche')).toBeVisible({ timeout: 30_000 });
}

export async function loginWithPassword(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'AMRtech Payment' })).toBeVisible();
  await page.getByLabel('E-Mail').fill(email);
  await page.getByLabel('Passwort').fill(password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/sales$/, { timeout: 20_000 });
  await waitForWorkspaceReady(page);
}

/** Alias für Supabase-Acceptance-Tests. */
export const loginWithSupabaseCredentials = loginWithPassword;

export async function logout(page: Page): Promise<void> {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
}

export async function assertProtectedRouteRedirectsToLogin(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
}

export async function assertNoTechnicalIds(page: Page): Promise<void> {
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
  expect(body).not.toMatch(/\buser_[0-9a-z_]+\b/i);
  expect(body).not.toMatch(/\blead_[0-9a-z_]+\b/i);
}

/** Direkter Lead-Zugriff ohne Berechtigung: RLS liefert null → „Kunde nicht gefunden“ (kein Datenleck). */
export async function assertSecureForeignLeadAccess(
  page: Page,
  leadId: string,
  forbiddenCompanyLabel = '',
): Promise<void> {
  await page.goto(`/leads/${leadId}`);
  await expect(page).toHaveURL(new RegExp(`/leads/${leadId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await expect(
    page.getByRole('heading', { name: /Zugriff verweigert|Kunde nicht gefunden/ }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('navigation', { name: 'Kundenakte Bereiche' })).toHaveCount(0);
  if (forbiddenCompanyLabel.trim()) {
    await expect(page.getByText(forbiddenCompanyLabel)).toHaveCount(0);
  }
  await assertNoTechnicalIds(page);
}

/** Wartet bis Vereinbarungsdetails im Dialog geladen sind (Regelfelder bedienbar). */
export async function waitForCommissionAssignmentDialogReady(dialog: Locator): Promise<void> {
  await expect(dialog.getByRole('heading', { name: 'Vereinbarung wird geladen' })).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeEnabled({ timeout: 30_000 });
}

/** Wartet auf Remote-Persistenz der Mitarbeitervereinbarung (Supabase assignment upsert). */
export async function saveCommissionAssignmentDialog(page: Page, dialog: Locator): Promise<void> {
  const saveButton = dialog.getByRole('button', { name: 'Speichern' });
  await expect(saveButton).toBeEnabled({ timeout: 30_000 });

  const waitForCommissionWrite = () =>
    page
      .waitForResponse(
        (response) => {
          const url = response.url();
          const method = response.request().method();
          return (
            (url.includes('commission_assignments') ||
              url.includes('commission_assignment_versions')) &&
            ['POST', 'PATCH'].includes(method) &&
            response.ok()
          );
        },
        { timeout: 60_000 },
      )
      .catch(() => null);

  const waitForSaveSuccess = async (): Promise<void> => {
    const writeDone = waitForCommissionWrite();
    const savedStatus = expect(
      page.getByRole('status').filter({ hasText: 'Vereinbarung gespeichert' }),
    ).toBeVisible({ timeout: 60_000 });
    const dialogClosed = expect(dialog).toHaveCount(0, { timeout: 60_000 });

    await saveButton.click();
    await Promise.race([Promise.all([writeDone, savedStatus]), dialogClosed]);
    await expect(dialog).toHaveCount(0, { timeout: 5_000 });
  };

  try {
    await waitForSaveSuccess();
  } catch {
    if ((await dialog.count()) === 0) {
      return;
    }
    const errorAlert = dialog.getByRole('alert');
    if (await errorAlert.isVisible()) {
      throw new Error(`Provisions-Save fehlgeschlagen: ${await errorAlert.innerText()}`);
    }
    // Kein erneuter Klick: laufender Save darf unter Last länger dauern.
    await expect(dialog).toHaveCount(0, { timeout: 60_000 });
    await expect(
      page.getByRole('status').filter({ hasText: 'Vereinbarung gespeichert' }),
    ).toBeVisible({ timeout: 5_000 });
  }
}

export async function startAdviceWithCustomer(page: Page, companyName: string): Promise<void> {
  await startNewAdvice(page);
  await expect(page.getByRole('heading', { name: 'Beratung', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Kunde suchen' }).click();
  await page.getByLabel('Suche').fill(ACCEPTANCE_TAG);
  await page.getByRole('button', { name: companyName }).click();
  // Kundenzuordnung speichert async – Weiter erst nach Ende von busy.
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByRole('heading', { name: 'Ausgangslage' })).toBeVisible({
    timeout: 20_000,
  });
}

export async function fillNeedStep(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Bedarf' })).toBeVisible();
  await chooseCustomOption(page, page.getByRole('combobox', { name: 'Branche' }), 'Einzelhandel');
  await page.getByLabel('Monatlicher Kartenumsatz (EUR)').fill('5000');
  await page.getByLabel('Monatliche Transaktionen (optional)').fill('400');
  await page.getByRole('button', { name: 'Weiter' }).click();
}

export async function calculateRecommendation(page: Page): Promise<void> {
  await ensureRecommendation(page);
  await expect(page.getByText(/NaN|Infinity/i)).toHaveCount(0);
}

export async function createOfferDraft(page: Page): Promise<string | null> {
  const offerHeading = page.getByRole('heading', { name: 'Angebot', level: 2 });
  if (!(await offerHeading.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Weiter' }).click();
  }
  await expect(offerHeading).toBeVisible();

  const draftLink = page.getByRole('link', { name: 'Entwurf öffnen' });
  if (!(await draftLink.isVisible())) {
    await page.getByRole('button', { name: 'Angebotsentwurf erzeugen' }).click();
    await expect(draftLink).toBeVisible({ timeout: 20_000 });
  }

  const href = await draftLink.getAttribute('href');
  return href?.match(/\/offers\/([^/?#]+)/)?.[1] ?? null;
}
