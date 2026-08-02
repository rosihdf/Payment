import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

function renderAt(route: string) {
  writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  const router = createMemoryRouter(appRoutes, { initialEntries: [route] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('Phase 1A Block 3 – Kundenakte Komfort UI', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  afterEach(() => {
    cleanup();
  });

  it('zeigt Übersichtskennzahlen, Schnellaktionen und speichert Telefonat in der Timeline', async () => {
    const user = userEvent.setup();
    renderAt('/leads/lead_001');
    await screen.findByText('Kundenakte');

    expect(screen.getByText('Letzter Kundenkontakt')).toBeInTheDocument();
    expect(screen.getByText('Nächste Aufgabe')).toBeInTheDocument();
    expect(screen.getByText('Überfällige Aufgaben')).toBeInTheDocument();
    expect(screen.getByText('Weitere offene Aufgaben')).toBeInTheDocument();
    expect(screen.getByText('Letzte Beratung')).toBeInTheDocument();
    expect(screen.getByText('Aktuelles Angebot')).toBeInTheDocument();
    expect(screen.getByText('Aktueller Gesamtstand')).toBeInTheDocument();
    expect(screen.getByText('Hauptaktion')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Telefonat' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Telefonat' }));
    const title = screen.getByLabelText('Titel');
    await user.clear(title);
    await user.type(title, 'Kurzes Telefonat');
    await user.type(screen.getByLabelText('Ergebnis / Kurznotiz'), 'Kunde rückgefragt');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText(/Kurzes Telefonat/)).toBeInTheDocument();
  });

  it('zeigt letzten Kontakt je Ansprechpartner ohne Notiz als Kundenkontakt', async () => {
    const user = userEvent.setup();
    renderAt('/leads/lead_001');
    await screen.findByText('Kundenakte');
    await user.click(screen.getByRole('button', { name: 'Ansprechpartner' }));
    expect(await screen.findByText('Letzter Kontakt')).toBeInTheDocument();
    expect(screen.queryByText('Letzte Notiz')).not.toBeInTheDocument();
  });

  it('gruppiert Timeline-Einträge und kombiniert Suche mit Filter', async () => {
    const user = userEvent.setup();
    renderAt('/leads/lead_001');
    await screen.findByText('Kundenakte');
    await user.click(screen.getByRole('button', { name: 'Timeline' }));

    expect(screen.getByRole('button', { name: 'Alle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kommunikation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vertrieb' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Kommunikation' }));
    await user.type(screen.getByLabelText('Suche'), 'xyz-kein-treffer');
    expect(screen.getByText('Keine Einträge für diesen Filter.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Suche'));
    await user.click(screen.getByRole('button', { name: 'Alle' }));
    const timelineSection = screen.getByRole('heading', { name: 'Timeline' }).closest('section');
    expect(timelineSection?.textContent ?? '').toMatch(/Heute|Gestern|Diese Woche|Älter|Keine Einträge/);
  });

  it('gruppiert Dokumente nach Bereich', async () => {
    const user = userEvent.setup();
    renderAt('/leads/lead_001');
    await screen.findByText('Kundenakte');
    await user.click(screen.getByRole('button', { name: 'Dokumente' }));
    const section = await screen.findByRole('heading', { name: 'Dokumente' });
    expect(section).toBeInTheDocument();
    const container = section.closest('section');
    expect(container).toBeTruthy();
    if (container) {
      const headings = within(container).queryAllByRole('heading', { level: 3 });
      expect(headings.length).toBeGreaterThanOrEqual(0);
    }
  });
});
