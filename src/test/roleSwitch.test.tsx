import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { openFormSelect, selectFormOptionByValue } from './helpers/selectFormOption';

function renderApp() {
  clearDemoDataForTests();
  resetDemoDataForTests();

  const memoryRouter = createMemoryRouter(appRoutes, {
    initialEntries: ['/'],
  });

  return render(
    <AppProviders>
      <RouterProvider router={memoryRouter} />
    </AppProviders>,
  );
}

async function waitForDemoUsersLoaded() {
  await waitFor(() => {
    expect(screen.getByRole('combobox', { name: 'Demo-Benutzer wechseln' })).toHaveAttribute(
      'data-value',
      'user_001',
    );
  });
}

describe('Role switching', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('updates navigation after switching to admin', async () => {
    const user = userEvent.setup();
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Arbeitsplatz' })).toBeInTheDocument();
    await waitForDemoUsersLoaded();

    await openFormSelect(user, 'Demo-Benutzer wechseln');
    await waitFor(() => {
      const values = screen.getAllByRole('option').map((option) => option.getAttribute('data-value'));
      expect(values).toContain('user_001');
      expect(values).toContain('user_004');
    });
    const optionLabels = screen.getAllByRole('option').map((option) => option.textContent ?? '');
    expect(optionLabels.every((text) => !text.includes('(Vertriebsleitung)'))).toBe(true);
    expect(optionLabels.every((text) => !text.includes('(Prüfer)'))).toBe(true);
    expect(optionLabels.every((text) => !text.includes('(Nur Lesen)'))).toBe(true);
    await user.keyboard('{Escape}');

    await selectFormOptionByValue(user, 'Demo-Benutzer wechseln', 'user_004');

    expect(screen.getByRole('combobox', { name: 'Demo-Benutzer wechseln' })).toHaveAttribute(
      'data-value',
      'user_004',
    );
    expect(screen.getAllByRole('link', { name: 'Verwaltung', hidden: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Profil' })[0]).toHaveAttribute('href', '/profile');
  });

  it('persists selected admin user in role switcher', async () => {
    const user = userEvent.setup();
    renderApp();

    await waitForDemoUsersLoaded();
    await selectFormOptionByValue(user, 'Demo-Benutzer wechseln', 'user_004');

    expect(screen.getByRole('combobox', { name: 'Demo-Benutzer wechseln' })).toHaveAttribute(
      'data-value',
      'user_004',
    );
  });
});
