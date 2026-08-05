import { expect, type Locator, type Page } from '@playwright/test';
import { createProductionPricingCatalog } from '../src/domain/catalog/pricingCatalogSeed';

/**
 * Alle "Select"-Felder der App (`components/common/FormControl.tsx`,
 * verwendet über `v2/ui/FormField.tsx`) sind Custom-Comboboxen
 * (`role="combobox"` + `role="listbox"`/`option`), keine nativen
 * `<select>`-Elemente. Daher hier bewusst über Klick + Options-Klick statt
 * `selectOption()`.
 */
export async function chooseCustomOption(
  page: Page,
  combobox: Locator,
  optionName: string | RegExp,
): Promise<void> {
  await combobox.click();
  await page.getByRole('option', { name: optionName }).click();
}

/** Sidebar-Navigation (`aria-label="Seitenleiste"`) – eindeutig gegenüber der parallel gerenderten mobilen Bottom-Navigation. */
export function sidebarNav(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Seitenleiste' });
}

export async function gotoSidebar(page: Page, label: string): Promise<void> {
  await sidebarNav(page).getByRole('link', { name: label }).click();
}

/** Kanonischer Einstieg „neue Beratung“ – eindeutig gegenüber Arbeitsplatz-Aktionslinks. */
export async function startNewAdvice(page: Page): Promise<void> {
  await gotoSidebar(page, 'Beratung');
  await page.locator('a[href="/advice?new=1"]').first().click();
}

/** Wartet auf Auto-Berechnung; aktualisiert nur bei Bedarf. */
export async function ensureRecommendation(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Empfehlung', exact: true })).toBeVisible();
  const primary = page.getByRole('heading', { name: 'Hauptempfehlung', exact: true });
  if (!(await primary.isVisible().catch(() => false))) {
    const update = page.getByRole('button', { name: /Empfehlung (berechnen|aktualisieren)/ });
    if (await update.isVisible().catch(() => false)) {
      await update.click();
    }
  }
  await expect(primary).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/^Gewählt: /)).toBeVisible();
}

/** Wechselt den Demo-Benutzer über den `RoleSwitcher` in der Kopfzeile (nur im lokalen Demo-Modus sichtbar). */
export async function switchDemoUser(page: Page, userLabel: string | RegExp): Promise<void> {
  const combobox = page.getByRole('combobox', { name: 'Demo-Benutzer wechseln' });
  await chooseCustomOption(page, combobox, userLabel);
}

/** Eindeutiger Marker für alle in E2E-Tests angelegten Testdaten, damit sie klar von Demo-/Produktionsdaten zu unterscheiden sind. */
export function e2eTag(): string {
  return `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Der lokale Demo-Modus startet bewusst mit einem LEEREN Preiskatalog
 * (siehe `src/services/pricingCatalogMigration.ts` + `pricingCatalogMigration.test.ts`,
 * "initializes empty catalog without invented prices") – ohne veröffentlichte
 * Preisliste bricht die Empfehlungs-Engine jeden Kandidaten mit
 * `PRICE_BOOK_NOT_FOUND` ab (`src/domain/pricingEngine/pricingEvaluationEngine.ts`).
 * Für den Empfehlungs-Schritt im Außendienst-E2E-Pfad wird daher – exakt wie beim
 * Produktions-Bootstrap (`scripts/bootstrap-production-catalog.ts`) – der bestehende
 * `createProductionPricingCatalog()`-Seed verwendet (reale, aus den Tarifgebühren
 * abgeleitete Preise, keine Erfindung neuer Engines/Daten). Muss vor dem ersten
 * `page.goto()` aufgerufen werden, damit die Werte schon beim App-Start in
 * `localStorage` liegen.
 */
export async function seedPricingCatalogForE2E(page: Page): Promise<void> {
  const catalog = createProductionPricingCatalog();
  await page.addInitScript((seed) => {
    window.localStorage.setItem('amrtech.priceBooks', JSON.stringify(seed.priceBooks));
    window.localStorage.setItem('amrtech.priceBookVersions', JSON.stringify(seed.priceBookVersions));
    window.localStorage.setItem('amrtech.contractTerms', JSON.stringify(seed.contractTerms));
    window.localStorage.setItem('amrtech.priceRules', JSON.stringify(seed.priceRules));
    window.localStorage.setItem('amrtech.pricingCatalogVersion', JSON.stringify(1));
  }, catalog);
}
