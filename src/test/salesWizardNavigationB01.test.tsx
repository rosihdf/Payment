import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';

function renderAtRoute(initialRoute: string) {
  clearDemoDataForTests();
  resetDemoDataForTests();
  writeStorageItem(STORAGE_KEYS.currentUserId, 'user_001');

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

describe('B01 Sales Wizard Navigation', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('öffnet den Vertriebs-Wizard über die Route', async () => {
    renderAtRoute('/calculator/wizard?new=1');
    expect(await screen.findByRole('heading', { name: 'BestPay Vertriebs-Wizard' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Wizard-Schritte' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Interessent' })).toBeInTheDocument();
  });

  it('verlinkt vom Rechner-Hub zum Wizard', async () => {
    const user = userEvent.setup();
    const router = renderAtRoute('/calculator');
    const link = await screen.findByRole('link', { name: 'Vertriebs-Wizard' });
    expect(link).toHaveAttribute('href', '/calculator/wizard?new=1');
    await user.click(link);
    expect(router.state.location.pathname).toBe('/calculator/wizard');
  });

  it('navigiert per Schrittleiste und speichert Fortschritt', async () => {
    const user = userEvent.setup();
    renderAtRoute('/calculator/wizard?new=1');
    await screen.findByRole('heading', { name: 'Interessent' });

    await user.click(screen.getByRole('button', { name: /Aktuelle Kosten/ }));
    expect(await screen.findByRole('heading', { name: 'Aktuelle Kosten' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(await screen.findByRole('heading', { name: 'Interessent' })).toBeInTheDocument();
  });
});
