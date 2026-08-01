import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { STORAGE_KEYS, writeStorageItem } from '../utils/storage';
import { ADVICE_PATH } from '../utils/routes';

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

describe('A11.5 BestPay history navigation', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('leitet Historieneinstieg auf Beratung um', async () => {
    const router = renderAtRoute('/calculator/bestpay/history');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(ADVICE_PATH);
    });
  });

  it('zeigt Beratungshub ohne parallelen Historieneinstieg', async () => {
    renderAtRoute('/advice');
    expect(await screen.findByRole('heading', { name: 'Beratung', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Gespeicherte Berechnungen/i })).not.toBeInTheDocument();
  });
});
