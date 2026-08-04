import { expect, test } from '@playwright/test';
import { chooseCustomOption, e2eTag, switchDemoUser } from './helpers';

/**
 * Admin-Kernpfad im lokalen Demo-Modus. Wechselt vom Standard-Demo-Nutzer
 * (Außendienst "Laura Berger") über den `RoleSwitcher` zum Admin-Demo-Nutzer
 * "Michael Weber" (`user_004`, siehe `createDemoUserSeed`), bearbeitet
 * Benutzer und Tarif, ändert eine Standardprovision inkl. echtem
 * Browser-Reload (`page.reload()` – kein In-Memory-State, echte
 * localStorage-Persistenz) und prüft die Erreichbarkeit von
 * Freigabe-/Onboarding-Verwaltung so weit wie mit den Demo-Daten möglich.
 */
test.describe('Admin: Benutzer, Tarif, Provisionsstandards, Freigabe/Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sales');
    await switchDemoUser(page, /Michael Weber/);
    await expect(
      page.getByRole('combobox', { name: 'Demo-Benutzer wechseln' }),
    ).toHaveText(/Michael Weber/);
  });

  test('bearbeitet einen Benutzer über die Benutzerverwaltung', async ({ page }) => {
    const tag = e2eTag();
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Benutzer', level: 1 })).toBeVisible();

    // `AdminUsersPage` rendert Tabellen- UND Karten-Ansicht parallel (responsive), beide mit
    // identischem `aria-label` – daher gezielt innerhalb der (sichtbaren) Tabellenzeile suchen.
    const row = page.getByRole('row', { name: /Thomas Klein/ }).first();
    await row.getByRole('button', { name: 'Bearbeiten' }).click();
    const nameInput = row.getByLabel(/Anzeigename für thomas.klein/);
    await nameInput.fill(`Thomas Klein ${tag}`);
    await row.getByRole('button', { name: 'Speichern' }).click();

    await expect(page.getByText(`Thomas Klein ${tag} aktualisiert`)).toBeVisible();
    // Tabellen- und Karten-Ansicht rendern denselben Namen parallel (responsive) – `.first()`.
    await expect(page.getByText(`Thomas Klein ${tag}`).first()).toBeVisible();
  });

  test('bearbeitet einen Tarif im Produktkatalog', async ({ page }) => {
    const tag = e2eTag();
    await page.goto('/admin/catalog?tab=tariffs');
    await expect(page.getByRole('heading', { name: 'Produkte & Konditionen' })).toBeVisible();

    await page.getByRole('link', { name: 'Bearbeiten' }).first().click();
    await expect(page.getByRole('heading', { name: 'Tarif bearbeiten' })).toBeVisible();

    const notesField = page.getByLabel('Interne Notizen');
    await notesField.fill(`${tag} – per E2E-Test aktualisiert`);
    await page.getByRole('button', { name: 'Änderungen speichern' }).click();

    await expect(page.getByText('Änderungen wurden gespeichert')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/catalog\?tab=tariffs$/);
  });

  test('ändert Standardprovision, Aktiv-Flag und Gültigkeit – Reload zeigt persistierte Werte', async ({
    page,
  }) => {
    await page.goto('/admin/commission/standards');
    await expect(
      page.getByRole('heading', { name: 'Provision – Standard & Vereinbarungen', level: 1 }),
    ).toBeVisible();

    const row = page.getByRole('row', { name: /Nur Acquiring/ }).first();
    await row.getByRole('button', { name: 'Bearbeiten' }).click();

    const amountInput = page.getByLabel('Standardbetrag (EUR)');
    await amountInput.fill('175');

    const validFromInput = page.getByLabel('Gültig ab');
    await validFromInput.fill('2026-02-01');
    const validUntilInput = page.getByLabel('Gültig bis');
    await validUntilInput.fill('2026-12-31');

    await chooseCustomOption(page, page.getByRole('combobox', { name: 'Aktiv' }), 'Inaktiv');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Standardregel „Nur Acquiring“ gespeichert')).toBeVisible();

    // Echter Browser-Reload (nicht nur In-Memory-Navigation) – localStorage bleibt erhalten,
    // React-State wird komplett neu aufgebaut. Beweist Persistenz über die Repository-Schicht.
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Provision – Standard & Vereinbarungen', level: 1 }),
    ).toBeVisible();
    const reloadedRow = page.getByRole('row', { name: /Nur Acquiring/ }).first();
    await expect(reloadedRow.getByText('175,00 €').first()).toBeVisible();
    await expect(reloadedRow.getByText('Nein')).toBeVisible();
    await expect(reloadedRow.getByText('2026-02-01')).toBeVisible();
    await expect(reloadedRow.getByText('2026-12-31')).toBeVisible();
  });

  test('Freigaberegeln und Onboarding (Aktivierungen) sind für Admin erreichbar', async ({
    page,
  }) => {
    await page.goto('/admin/approvals');
    await expect(page.getByRole('heading', { name: 'Freigaberegeln' })).toBeVisible();

    await page.goto('/activations');
    await expect(page.getByRole('heading', { name: 'Onboarding' })).toBeVisible();
    // Ohne im Test erzeugten Vertrag/Aktivierung zeigt die Demo-Instanz konsequent den Leerzustand –
    // das Anlegen eines vollständigen Angebot→Vertrag→Aktivierung-Life-Cycles als Admin ist in der
    // lokalen Demo nicht vorgesehen (dieser Pfad läuft über den Außendienst, siehe field-flow.spec.ts).
    await expect(
      page.getByText(/Keine Aktivierungen|Aktivierungen werden geladen/).first(),
    ).toBeVisible();
  });
});
