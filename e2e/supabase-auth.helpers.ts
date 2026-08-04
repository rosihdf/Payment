import { expect, type Page } from '@playwright/test';
import { gotoSidebar, chooseCustomOption } from './helpers';

export const ACCEPTANCE_TAG = 'CORE_REPAIR_BROWSER';
export const TEST_COMPANY = `${ACCEPTANCE_TAG} Test GmbH`;

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
  await expect(page.getByRole('heading', { name: 'Arbeitsplatz' })).toBeVisible({
    timeout: 20_000,
  });
}

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
  await page.getByRole('button', { name: 'Angebotsentwurf erzeugen' }).click();
  await expect(page.getByText(/^Angebot .+/)).toBeVisible({ timeout: 20_000 });
  const offerLink = page.getByRole('link', { name: /^Angebot / }).first();
  const href = await offerLink.getAttribute('href');
  return href?.match(/\/offers\/([^/?#]+)/)?.[1] ?? null;
}
