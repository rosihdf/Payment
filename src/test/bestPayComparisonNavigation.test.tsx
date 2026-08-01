import { render, waitFor } from '@testing-library/react';
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

describe('A11.4 BestPay calculator navigation', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('leitet parallelen BestPay-Einstieg auf Beratung um', async () => {
    const router = renderAtRoute('/calculator/bestpay?mode=manual&new=1');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(ADVICE_PATH);
    });
  });

  it('leitet BestPay-Neu-Einstieg auf Beratung um', async () => {
    const router = renderAtRoute('/calculator/bestpay?new=1');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(ADVICE_PATH);
    });
  });
});
