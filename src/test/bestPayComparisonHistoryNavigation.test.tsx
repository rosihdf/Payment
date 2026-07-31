import { render, screen } from '@testing-library/react';
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
}

describe('A11.5 BestPay history navigation', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('öffnet Historienroute', async () => {
    renderAtRoute('/calculator/bestpay/history');
    expect(
      await screen.findByRole('heading', { name: 'Gespeicherte BestPay-Berechnungen' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Neuer Vergleich' })).toBeInTheDocument();
    expect(screen.getByLabelText('Berechnungen durchsuchen')).toBeInTheDocument();
  });

  it('zeigt Einstieg auf dem Beratungshub', async () => {
    renderAtRoute('/calculator');
    expect(await screen.findByRole('link', { name: 'Gespeicherte Vergleiche' })).toBeInTheDocument();
  });
});
