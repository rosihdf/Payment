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

describe('Product navigation and protection', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('shows not found for unknown product id', async () => {
    renderAtRoute('/admin/products/manage/product_unknown/edit');

    expect(await screen.findByText('Produkt nicht gefunden')).toBeInTheDocument();
  });

  it('shows access denied for field service on admin overview', async () => {
    renderAtRoute('/admin/products/manage', 'user_001');

    expect(await screen.findByRole('heading', { name: 'Zugriff verweigert' })).toBeInTheDocument();
  });

  it('shows access denied for field service on new route', async () => {
    renderAtRoute('/admin/products/manage/new', 'user_001');

    expect(await screen.findByRole('heading', { name: 'Zugriff verweigert' })).toBeInTheDocument();
  });

  it('shows create action for admin on overview', async () => {
    renderAtRoute('/admin/products/manage');

    expect(await screen.findByRole('link', { name: 'Produkt anlegen' })).toHaveAttribute(
      'href',
      '/admin/products/manage/new',
    );
  });

  it('closes leave dialog on continue editing', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/products/manage/new');

    await user.type(await screen.findByLabelText('Produktname'), 'Dialog Test');
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await user.click(await screen.findByRole('button', { name: 'Weiter bearbeiten' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Produktname')).toHaveValue('Dialog Test');
  });

  it('discards changes from leave dialog', async () => {
    const user = userEvent.setup();
    renderAtRoute('/admin/products/manage/new');

    await user.type(await screen.findByLabelText('Produktname'), 'Verwerfen Test');
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await user.click(await screen.findByRole('button', { name: 'Änderungen verwerfen' }));

    expect(navigateMock).toHaveBeenCalledWith('/admin/products/manage', { replace: true });
  });
});
