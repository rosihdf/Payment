import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { gotoSidebar, chooseCustomOption } from './helpers';

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
    timeout: 20_000,
  });
  await expect(page.getByRole('heading', { name: 'Arbeitsplatz wird geladen' })).toHaveCount(0, {
    timeout: 20_000,
  });
  await expect(page.getByLabel('Suche')).toBeVisible({ timeout: 20_000 });
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

export async function startAdviceWithCustomer(page: Page, companyName: string): Promise<void> {
  await gotoSidebar(page, 'Beratung');
  await page.getByRole('link', { name: 'Beratung starten' }).click();
  await expect(page.getByRole('heading', { name: 'Beratung', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Kunde suchen' }).click();
  await page.getByLabel('Suche').fill(ACCEPTANCE_TAG);
  await page.getByRole('button', { name: companyName }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
}

export async function fillNeedStep(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Bedarf' })).toBeVisible();
  await chooseCustomOption(page, page.getByRole('combobox', { name: 'Branche' }), 'Einzelhandel');
  await page.getByLabel('Monatlicher Kartenumsatz (EUR)').fill('5000');
  await page.getByLabel('Monatliche Transaktionen (optional)').fill('400');
  await page.getByRole('button', { name: 'Weiter' }).click();
}

export async function calculateRecommendation(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Empfehlung' })).toBeVisible();
  await page.getByRole('button', { name: 'Empfehlung berechnen' }).click();
  await expect(page.getByRole('heading', { name: 'Hauptempfehlung' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/^Gewählt: /)).toBeVisible();
  await expect(page.getByText(/NaN|Infinity/i)).toHaveCount(0);
}

export async function createOfferDraft(page: Page): Promise<string | null> {
  await page.getByRole('button', { name: '5 Angebot' }).click();
  await expect(page.getByRole('heading', { name: 'Angebot', level: 2 })).toBeVisible();

  const draftLink = page.getByRole('link', { name: 'Entwurf öffnen' });
  if (!(await draftLink.isVisible())) {
    await page.getByRole('button', { name: 'Angebotsentwurf erzeugen' }).click();
    await expect(draftLink).toBeVisible({ timeout: 20_000 });
  }

  const href = await draftLink.getAttribute('href');
  return href?.match(/\/offers\/([^/?#]+)/)?.[1] ?? null;
}
