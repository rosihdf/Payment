/**
 * UI-Ebene des Provisions-Persistenznachweises (Task A "PROVISION PERSISTENCE PROOF").
 *
 * Rendert die echten Routen aus `appRoutes` mit `AppProviders` (wie
 * `v2ResponsiveViewport.test.tsx`) und bedient die Admin-Seite
 * `/admin/commission/standards` (siehe `CommissionStandardsPage`, die
 * `CommissionModelsPanel` und `CommissionAssignmentsPanel` kombiniert) über
 * echte Nutzerinteraktionen (Klicks, Eingaben).
 *
 * Persistenzpfad: UI-Komponente → `useServices()` → `CommissionCatalogAdminService`
 * / `CommissionAdminService` → `LocalCommissionCatalogRepository` /
 * `LocalCommissionWorkflowRepository` → `localStorage` (jsdom).
 *
 * "Reload" wird durch vollständiges Unmounten (`cleanup()`) und Neu-Rendern
 * eines frischen `createMemoryRouter` an derselben Route simuliert – die
 * Provider erzeugen dabei neue Service-/Repository-Instanzen, lesen aber
 * denselben `localStorage`-Zustand, beweisen also einen echten Reload statt
 * In-Memory-React-State.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

const STANDARDS_ROUTE = '/admin/commission/standards';

function renderStandardsPageAs(userId: string) {
  writeStorageItem(STORAGE_KEYS.currentUserId, userId);
  const router = createMemoryRouter(appRoutes, { initialEntries: [STANDARDS_ROUTE] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

/** Findet die Desktop-Tabellenzeile (`<tr>`) zu einem Text, unabhängig von der parallel gerenderten Mobile-Kartenansicht. */
function getDesktopRowByText(text: string): HTMLElement {
  const matches = screen.getAllByText(text);
  const cell = matches.find((element) => element.closest('tr'));
  if (!cell) {
    throw new Error(`Keine Tabellenzeile für Text "${text}" gefunden`);
  }
  return cell.closest('tr') as HTMLElement;
}

/** `ResponsiveTable` rendert Desktop-Tabelle und Mobile-Karten parallel – daher immer über die Zeile warten statt auf einzelnen Text. */
async function waitForDesktopRow(text: string): Promise<HTMLElement> {
  let row: HTMLElement | undefined;
  await waitFor(() => {
    row = getDesktopRowByText(text);
  });
  return row!;
}

function getAssignmentDialog(): HTMLElement {
  return screen.getByRole('dialog');
}

function getDesktopRowByTextWithin(container: HTMLElement, text: string): HTMLElement {
  const matches = within(container).getAllByText(text);
  const cell = matches.find((element) => element.closest('tr'));
  if (!cell) {
    throw new Error(`Keine Tabellenzeile für Text "${text}" innerhalb der Sektion gefunden`);
  }
  return cell.closest('tr') as HTMLElement;
}

async function waitForEmployeeRuleRowInDialog(ruleName: string): Promise<HTMLElement> {
  let row: HTMLElement | undefined;
  await waitFor(() => {
    row = getDesktopRowByTextWithin(getAssignmentDialog(), ruleName);
  });
  return row!;
}

describe('Provision – Admin-UI-Persistenznachweis (/admin/commission/standards)', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it('Admin ändert Standardbetrag, Aktiv-Flag und Gültigkeit einer Standardregel, speichert – Reload zeigt die Werte', async () => {
    const user = userEvent.setup();
    renderStandardsPageAs('user_004');

    expect(
      await screen.findByRole('heading', { name: 'Provision – Standard & Vereinbarungen', level: 1 }),
    ).toBeInTheDocument();

    // "ACQ-only" (CLASSIC) ist Teil des Standardkatalogs (commissionCatalogSeed.ts).
    const row = await waitForDesktopRow('ACQ-only');
    await user.click(within(row).getByRole('button', { name: 'Bearbeiten' }));

    const amountInput = await screen.findByLabelText('Standardbetrag (EUR)');
    fireEvent.change(amountInput, { target: { value: '175' } });

    const validFromInput = screen.getByLabelText('Gültig ab');
    await user.clear(validFromInput);
    await user.type(validFromInput, '2026-02-01');

    const validUntilInput = screen.getByLabelText('Gültig bis');
    await user.clear(validUntilInput);
    await user.type(validUntilInput, '2026-12-31');

    // "Aktiv" ist ein Custom-Select (Combobox) – auf "Inaktiv" umstellen.
    const activeCombobox = screen.getByRole('combobox', { name: 'Aktiv' });
    await user.click(activeCombobox);
    await user.click(await screen.findByRole('option', { name: 'Inaktiv' }));

    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await screen.findByText('Standardregel „ACQ-only“ gespeichert');

    // Reload: komplett neu mounten, gleiche Route, gleicher localStorage-Zustand.
    cleanup();
    renderStandardsPageAs('user_004');
    const reloadedRow = await waitForDesktopRow('ACQ-only');
    // "Standardbetrag" und "Berechnet" (100 % Standard) zeigen denselben Wert.
    expect(within(reloadedRow).getAllByText('175,00 €')).toHaveLength(2);
    expect(within(reloadedRow).getByText('Nein')).toBeInTheDocument();
    expect(within(reloadedRow).getByText('2026-02-01')).toBeInTheDocument();
    expect(within(reloadedRow).getByText('2026-12-31')).toBeInTheDocument();
  });

  it(
    'Mitarbeiteranteil 0–100 % mit live berechnetem Eurobetrag, speichern, Reload, Reset auf Standard',
    async () => {
    const user = userEvent.setup();
    renderStandardsPageAs('user_004');

    await screen.findByRole('heading', { name: 'Provision – Standard & Vereinbarungen', level: 1 });
    await waitForDesktopRow('ACQ-only');

    // Außendienstmitarbeiterin "Laura Berger" (user_001) erhält per Default 100 % Standard.
    const repRow = await waitForDesktopRow('Laura Berger');
    await user.click(within(repRow).getByRole('button', { name: 'Bearbeiten' }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(
      () => {
        expect(within(dialog).getByLabelText('ACQ-only %')).toHaveValue('100');
      },
      { timeout: 8000 },
    );
    const shareInput = within(dialog).getByLabelText('ACQ-only %');

    fireEvent.change(shareInput, { target: { value: '80' } });
    await waitFor(() => {
      expect(shareInput).toHaveValue('80');
    });

    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Vereinbarung gespeichert')).toBeInTheDocument();

    // Reload: neu mounten, Mitarbeiterin erneut öffnen – individueller Anteil ist persistiert.
    cleanup();
    renderStandardsPageAs('user_004');
    const reloadedRepRow = await waitForDesktopRow('Laura Berger');
    expect(within(reloadedRepRow).getByText('Individuell')).toBeInTheDocument();
    await user.click(within(reloadedRepRow).getByRole('button', { name: 'Bearbeiten' }));

    const reloadedDialog = await screen.findByRole('dialog');
    expect(within(reloadedDialog).getByLabelText('ACQ-only %')).toHaveValue('80');
    await waitForEmployeeRuleRowInDialog('ACQ-only');
    await waitFor(() => {
      const row = getDesktopRowByTextWithin(reloadedDialog, 'ACQ-only');
      expect(within(row).getByText('120,00 €')).toBeInTheDocument();
    });

    // Auf Standard (100 %) zurücksetzen.
    await user.click(
      within(reloadedDialog).getByRole('button', { name: 'Auf Standard (100 %) zurücksetzen' }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Auf 100 % Standard zurückgesetzt')).toBeInTheDocument();

    // Erneuter Reload bestätigt die Rücksetzung dauerhaft.
    cleanup();
    renderStandardsPageAs('user_004');
    const finalRepRow = await waitForDesktopRow('Laura Berger');
    expect(within(finalRepRow).getByText('Standard (100 %)')).toBeInTheDocument();
    await user.click(within(finalRepRow).getByRole('button', { name: 'Bearbeiten' }));
    const finalDialog = await screen.findByRole('dialog');
    expect(within(finalDialog).getByLabelText('ACQ-only %')).toHaveValue('100');
    },
    20_000,
  );

  it('Außendienst kann die Provisions-Standardseite nicht schreiben (UI zeigt Zugriff verweigert, keine Formularelemente)', async () => {
    renderStandardsPageAs('user_001');

    expect(
      await screen.findByRole('heading', { name: 'Zugriff verweigert', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Provision – Standard & Vereinbarungen' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Standardbetrag (EUR)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Speichern' })).not.toBeInTheDocument();
  });
});
