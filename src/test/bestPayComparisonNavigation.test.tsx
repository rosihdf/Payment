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

describe('A11.4 BestPay calculator navigation', () => {
  beforeEach(() => {
    clearDemoDataForTests();
    resetDemoDataForTests();
  });

  it('öffnet BestPay-Vergleich über direkte Route', async () => {
    renderAtRoute('/calculator/bestpay?mode=manual&new=1');
    expect(await screen.findByRole('heading', { name: 'BestPay-Vergleich' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BestPay berechnen' })).toBeInTheDocument();
  });

  it('zeigt Abrechnung-einlesen Einstieg', async () => {
    renderAtRoute('/calculator/bestpay?new=1');
    expect(await screen.findByRole('button', { name: 'Abrechnung einlesen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Werte manuell eingeben' })).toBeInTheDocument();
  });
});
