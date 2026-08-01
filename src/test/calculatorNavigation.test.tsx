import { render, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers/AppProviders';
import { appRoutes } from '../app/router';
import { clearDemoDataForTests, resetDemoDataForTests } from '../services/demoDataService';
import { writeStorageItem, STORAGE_KEYS } from '../utils/storage';
import { ADVICE_PATH } from '../utils/routes';

function renderAtRoute(initialRoute: string, currentUserId = 'user_001') {
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

describe('Calculator navigation and access', () => {
  it('leitet Schnellrechner für Außendienst auf Beratung um', async () => {
    const router = renderAtRoute('/advice/quick', 'user_001');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(ADVICE_PATH);
    });
  });

  it('leitet Schnellrechner für Admin auf Beratung um', async () => {
    const router = renderAtRoute('/advice/quick', 'user_004');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(ADVICE_PATH);
    });
  });
});
