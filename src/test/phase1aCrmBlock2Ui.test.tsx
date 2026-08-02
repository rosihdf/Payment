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

describe('Phase 1A Block 2 – Kundenakte CRM UI', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
    writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');
  });

  afterEach(() => {
    cleanup();
  });

  it('zeigt die verbindliche Tab-Reihenfolge in der Kundenakte', async () => {
    renderAt('/leads/lead_001');
    expect(await screen.findByText('Kundenakte')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Kundenakte Bereiche' });
    const buttons = within(nav).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Übersicht',
      'Ansprechpartner',
      'Timeline',
      'Aufgaben',
      'Notizen',
      'Dokumente',
      'Beratung',
      'Angebote',
      'Verträge',
      'Aktivierungen',
      'Provision',
    ]);
  });

  it('legt einen Ansprechpartner an und zeigt ihn in der Liste', async () => {
    const user = userEvent.setup();
    renderAt('/leads/lead_001');
    await screen.findByText('Kundenakte');

    await user.click(screen.getByRole('button', { name: 'Ansprechpartner' }));
    expect(await screen.findByRole('heading', { name: 'Ansprechpartner' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Neu' }));
    await user.type(screen.getByLabelText('Vorname'), 'Clara');
    await user.type(screen.getByLabelText('Nachname'), 'Beispiel');
    await user.type(screen.getByLabelText('Telefon'), '+49 30 111');
    await user.type(screen.getByLabelText('E-Mail'), 'clara@example.com');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText(/Clara Beispiel/)).toBeInTheDocument();
    expect(screen.getByText(/Primärkontakt/)).toBeInTheDocument();
  });

  it('zeigt Timeline-Filter und Aufgaben-Tab ohne neue Route', async () => {
    const user = userEvent.setup();
    renderAt('/leads/lead_001');
    await screen.findByText('Kundenakte');

    await user.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(await screen.findByRole('heading', { name: 'Timeline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Telefonat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Besuch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Notiz' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Aufgabe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kommunikation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vertrieb' })).toBeInTheDocument();
    expect(screen.getByLabelText('Suche')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Aufgaben' }));
    expect(await screen.findByRole('heading', { name: 'Aufgaben' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Neu' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Notizen' }));
    expect(await screen.findByText(/Timeline-Einträge vom Typ/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Provision' }));
    expect(await screen.findByRole('link', { name: 'Zur Provision' })).toHaveAttribute(
      'href',
      '/sales/commission',
    );
  });
});
