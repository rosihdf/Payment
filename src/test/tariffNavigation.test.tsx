import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

function renderAtRoute(initialRoute: string, currentUserId = 'user_004') {
  clearDemoDataForTests();
  resetDemoDataForTests();
  writeStorageItem(STORAGE_KEYS.currentUserId, currentUserId);

  const memoryRouter = createMemoryRouter(appRoutes, {
    initialEntries: [initialRoute],
  });

  render(
    <AppProviders>
      <RouterProvider router={memoryRouter} />
    </AppProviders>,
  );

  return memoryRouter;
}

describe('Tariff navigation and protection', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('shows not found for unknown tariff id', async () => {
    renderAtRoute('/admin/tariffs/tariff_unknown/edit');

    expect(await screen.findByText('Tarif nicht gefunden')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zur Tarifverwaltung' })).toHaveAttribute(
      'href',
      '/admin/tariffs',
    );
  });

  it('shows access denied for field service on new route', async () => {
    renderAtRoute('/admin/tariffs/new', 'user_001');

    expect(await screen.findByRole('heading', { name: 'Zugriff verweigert' })).toBeInTheDocument();
  });

  it('closes leave dialog on continue editing', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/tariffs/new');

    await user.type(await screen.findByLabelText('Tarifname'), 'Dialog Test');
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await user.click(await screen.findByRole('button', { name: 'Weiter bearbeiten' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tarifname')).toHaveValue('Dialog Test');
  });

  it('discards changes from leave dialog', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/tariffs/new');

    await user.type(await screen.findByLabelText('Tarifname'), 'Verwerfen Test');
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await user.click(await screen.findByRole('button', { name: 'Änderungen verwerfen' }));

    expect(navigateMock).toHaveBeenCalledWith('/admin/tariffs', { replace: true });
  });
});
