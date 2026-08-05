import { expect, test } from '@playwright/test';
import {
  chooseCustomOption,
  e2eTag,
  ensureRecommendation,
  gotoSidebar,
  seedPricingCatalogForE2E,
  sidebarNav,
  startNewAdvice,
} from './helpers';

/**
 * Außendienst-Kernpfad im lokalen Demo-Modus (localStorage-Persistenz, kein
 * Supabase, keine Produktions-Secrets). Jeder Playwright-Test bekommt einen
 * frischen Browser-Context (leerer localStorage) – beim ersten Laden seedet
 * `ServicesProvider` → `seedDemoData()` automatisch Demo-Nutzer, -Kunden,
 * -Tarife und -Produkte (siehe `src/services/demoDataService.ts`) und setzt
 * den Demo-Benutzer auf "Laura Berger" (Außendienst) – das ist der
 * "Login/Demo-Benutzer"-Schritt.
 */
test.describe('Außendienst: Kunde, Beratung ohne Kunden, Angebot, Provision', () => {
  test('durchläuft Kundensuche, Neuanlage, Beratung, Angebot, Nachfassen und Provisionsseite', async ({
    page,
  }) => {
    const tag = e2eTag();

    // Preiskatalog vor dem ersten Laden seeden (siehe seedPricingCatalogForE2E-Doku) – sonst
    // bricht die Empfehlungs-Engine mangels veröffentlichter Preisliste jeden Kandidaten ab.
    await seedPricingCatalogForE2E(page);

    // 1) Login/Demo-Benutzer: Startseite leitet automatisch als Außendienst "Laura Berger" auf /sales.
    await page.goto('/');
    await expect(page).toHaveURL(/\/sales$/);
    await expect(page.getByRole('heading', { name: 'Arbeitsplatz' })).toBeVisible();
    await expect(
      page.getByRole('combobox', { name: 'Demo-Benutzer wechseln' }),
    ).toHaveText(/Laura Berger/);

    // 2) Kunde suchen (bestehender Demo-Kunde, DEMO_LEAD_ASSIGNMENTS weist "lead_001" Laura Berger
    // (user_001) zu – als Außendienst sieht sie nur ihre eigenen Kunden, siehe normalizeLead.ts).
    await gotoSidebar(page, 'Kunden');
    await expect(page.getByRole('heading', { name: 'Kunden', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Kunden werden geladen' })).toHaveCount(0);
    await page.getByRole('searchbox', { name: 'Kunden-Suche' }).fill('Sonnenschein');
    await expect(page.getByText('Café Sonnenschein GmbH')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Kunden-Suche' }).fill('');

    // 3) Neuen Kunden minimal anlegen (klar getaggter Name).
    await page.getByRole('link', { name: 'Neuer Kunde' }).click();
    await expect(page.getByRole('heading', { name: 'Neuen Kunden aufnehmen' })).toBeVisible();
    const companyName = `${tag} Handel GmbH`;
    await page.getByLabel('Firmenname').fill(companyName);
    await page.getByLabel('Vorname').fill('E2E');
    await page.getByLabel('Nachname').fill('Tester');
    await page.getByLabel('Telefonnummer').fill('030 1234567');
    await page.getByRole('button', { name: 'Kunde speichern' }).click();

    // Erfolgreiches Anlegen navigiert zur Kundenakte (/leads/:id).
    await expect(page.getByRole('heading', { name: companyName })).toBeVisible();

    // 4) Beratung OHNE Kunden starten (eigener, unabhängiger Ablauf – "Ohne Kundenzuordnung beraten").
    await startNewAdvice(page);
    await expect(page.getByRole('heading', { name: 'Beratung', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Ohne Kundenzuordnung beraten' }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();

    // 5) Ausgangslage: manuelle Kosten inkl. 0 € (OCR-Pfad bleibt alternativ wählbar).
    await expect(page.getByRole('heading', { name: 'Ausgangslage' })).toBeVisible();
    await page.getByRole('button', { name: 'Kosten manuell eingeben' }).click();
    const costsInput = page.getByLabel('Monatliche Ist-Gesamtkosten (EUR)');
    await costsInput.fill('0');
    await costsInput.blur();
    await expect(costsInput).toHaveValue(/0,00\s*€/);
    await page.getByRole('button', { name: 'Weiter' }).click();

    // 6) Bedarf & Branche.
    await expect(page.getByRole('heading', { name: 'Bedarf' })).toBeVisible();
    await chooseCustomOption(page, page.getByRole('combobox', { name: 'Branche' }), 'Einzelhandel');
    await page.getByLabel('Monatlicher Kartenumsatz (EUR)').fill('5000');
    await page.getByLabel('Monatliche Transaktionen (optional)').fill('400');
    await page.getByRole('button', { name: 'Weiter' }).click();

    // 7) Empfehlung wird beim Eintritt automatisch berechnet.
    await ensureRecommendation(page);

    // 7b) Angebot braucht einen Kunden: zurück zu „Kunde“, zuordnen, dann per „Weiter“
    // wieder vor bis Angebot (Vorwärtssprung in der Schrittleiste ist bewusst gesperrt).
    await page.getByRole('button', { name: '1 Kunde' }).click();
    await expect(page.getByRole('heading', { name: 'Kunde', level: 2 })).toBeVisible();
    await page.getByRole('button', { name: 'Kunde suchen' }).click();
    await page.getByLabel('Suche').fill(tag);
    await page.getByRole('button', { name: companyName }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByRole('heading', { name: 'Ausgangslage' })).toBeVisible();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByRole('heading', { name: 'Bedarf' })).toBeVisible();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await ensureRecommendation(page);
    await page.getByRole('button', { name: 'Weiter' }).click();

    // 8) Angebot erzeugen.
    await expect(page.getByRole('heading', { name: 'Angebot', level: 2 })).toBeVisible();
    await page.getByRole('button', { name: 'Angebotsentwurf erzeugen' }).click();
    await expect(page.getByText(/^Angebot .+/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Weiter' }).click();

    // 9) Prüfung & Nachfassen: Wiedervorlage-Notiz (Follow-up) + Abschluss.
    await expect(page.getByRole('heading', { name: 'Prüfung & Nachfassen' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByLabel('Wiedervorlage / Notiz').fill(`${tag} Nachfassen in 7 Tagen`);
    await page.getByRole('button', { name: 'Beratung abschließen' }).click();

    // 10) Zur "Meine Provision"-Seite (nur eigene Werte, kein Bearbeiten für Außendienst).
    await page.getByRole('link', { name: 'Zum Arbeitsplatz' }).click();
    await expect(page).toHaveURL(/\/sales$/);
    await page.getByRole('link', { name: 'Meine Provision' }).click();
    await expect(page).toHaveURL(/\/sales\/commission$/);
    await expect(page.getByRole('heading', { name: 'Meine Provision' })).toBeVisible();
    await expect(page.getByText('Nur eigene Daten – keine Bearbeitung')).toBeVisible();
  });

  test('Außendienst hat keinen Zugriff auf die Provisions-Verwaltung (Standardregeln)', async ({
    page,
  }) => {
    await page.goto('/admin/commission/standards');
    await expect(page.getByRole('heading', { name: 'Zugriff verweigert' })).toBeVisible();
    await expect(sidebarNav(page).getByRole('link', { name: 'Verwaltung' })).toHaveCount(0);
  });
});
